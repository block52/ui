import { useState, useEffect, useMemo, useRef } from "react";
import { GameFormat, CosmosClient, getDefaultCosmosConfig, PlayerDTO, computeGameNameFee } from "@block52/poker-vm-sdk";
import { Link, useNavigate } from "react-router-dom";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { isValidPlayerAddress } from "../utils/addressUtils";
import { isEmpty } from "../utils/guards";
import { useNewTable } from "../hooks/game/useNewTable";
import { useFindGames } from "../hooks/game/useFindGames";
import { toast } from "react-toastify";
import { copyToClipboard } from "../utils/clipboard";
import { formatMicroAsUsdc, USDC_DECIMALS, microToUsdc } from "../constants/currency";
import { validateTableName, normalizeTableName, tableNameCharCount } from "../utils/tableName";
import { Card, CardHeader, ChoicePill, PillButton, pillClass, Select, StatStrip } from "../components/ui";
import TableList from "../components/TableList";
import { calculateBuyIn, BUY_IN_PRESETS } from "../utils/buyInUtils";
import { sortTablesByAvailableSeats } from "../utils/tableSortingUtils";
import { BLIND_LEVELS, DEFAULT_BLIND_LEVEL_INDEX } from "../constants/blindLevels";
import { isTournamentFormat, getGameFormat, toGameFormat } from "../utils/gameFormatUtils";
import { computeTableCreationFeeMicro, CREATION_FEE_BIG_BLINDS } from "../utils/tableCreationFee";
import AdvancedSngParamsModal from "../components/modals/AdvancedSngParamsModal";
import type { AdvancedSngParams } from "../utils/sngAdvancedParams";

interface TableData {
    gameId: string;
    gameFormat: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    minBuyIn: string;
    maxBuyIn: string;
    smallBlind: string;
    bigBlind: string;
    timeout?: number;
    status: string;
    creator?: string;
    createdAt?: string;
}

export default function TableAdminPage() {
    const navigate = useNavigate();
    const cosmosWallet = useCosmosWallet();
    const { createTable, isCreating, error: createError } = useNewTable();
    const { games: fetchedGames, isLoading, error: gamesError, refetch } = useFindGames();

    const [gameFormat, setGameFormat] = useState<GameFormat>(GameFormat.CASH);
    const [tableName, setTableName] = useState("");
    const [minPlayers] = useState(2);
    const [maxPlayers, setMaxPlayers] = useState(9);
    
    // Selected blind level (index in BLIND_LEVELS array) — cash games only
    const [selectedBlindLevel, setSelectedBlindLevel] = useState(DEFAULT_BLIND_LEVEL_INDEX);

    // SNG/Tournament blind values (in chips, not dollars)
    const [sngSmallBlind, setSngSmallBlind] = useState(25);
    const [sngBigBlind, setSngBigBlind] = useState(50);

    const smallBlind = useMemo(() => {
        if (isTournamentFormat(gameFormat)) {
            return sngSmallBlind.toString();
        }
        return BLIND_LEVELS[selectedBlindLevel].smallBlind.toString();
    }, [gameFormat, sngSmallBlind, selectedBlindLevel]);

    const bigBlind = useMemo(() => {
        if (isTournamentFormat(gameFormat)) {
            return sngBigBlind.toString();
        }
        return BLIND_LEVELS[selectedBlindLevel].bigBlind.toString();
    }, [gameFormat, sngBigBlind, selectedBlindLevel]);

    const handleGameFormatChange = (newType: GameFormat) => {
        setGameFormat(newType);
        // SNG/Tournament only supports chain-defined entrant counts.
        // Snap an out-of-range maxPlayers to the nearest valid value.
        if (isTournamentFormat(newType)) {
            const validSngCounts = [2, 4, 6, 9];
            if (!validSngCounts.includes(maxPlayers)) {
                const next = validSngCounts.reduce((a, b) =>
                    Math.abs(b - maxPlayers) < Math.abs(a - maxPlayers) ? b : a
                );
                setMaxPlayers(next);
            }
        }
    };
    // Buy-in in Big Blinds (BB) for Cash games
    const [minBuyInBB, setMinBuyInBB] = useState(20);
    const [maxBuyInBB, setMaxBuyInBB] = useState(100);
    // For tournaments: single buy-in amount
    const [tournamentBuyIn, setTournamentBuyIn] = useState("10");
    // SNG/Tournament specific settings
    const [startingStack, setStartingStack] = useState(1500);
    const [blindLevelDuration, setBlindLevelDuration] = useState(10);
    // Flat entry fee in USDC dollars (2dp), skimmed to the creator on top of the
    // buy-in. "0" = no fee.
    const [entryFee, setEntryFee] = useState("0");
    const [showStructure, setShowStructure] = useState(false);
    const [showAdvancedModal, setShowAdvancedModal] = useState(false);

    // Apply advanced JSON params back into the SNG form state. Any field the
    // user omitted keeps its current value (mergeAdvancedParams handles that in
    // the modal; here we only write fields that were actually provided).
    const handleApplyAdvancedParams = (params: AdvancedSngParams) => {
        if (params.maxPlayers !== undefined) setMaxPlayers(params.maxPlayers);
        if (params.startingStack !== undefined) setStartingStack(params.startingStack);
        if (params.smallBlind !== undefined) setSngSmallBlind(params.smallBlind);
        if (params.bigBlind !== undefined) setSngBigBlind(params.bigBlind);
        if (params.blindLevelDuration !== undefined) setBlindLevelDuration(params.blindLevelDuration);
        if (params.buyIn !== undefined) setTournamentBuyIn(params.buyIn.toString());
    };

    const { minBuyIn: calculatedMinBuyIn, maxBuyIn: calculatedMaxBuyIn } = useMemo(
        () => calculateBuyIn({ minBuyInBB, maxBuyInBB, bigBlind: parseFloat(bigBlind) || 0 }),
        [minBuyInBB, maxBuyInBB, bigBlind]
    );

    const [enableRake, setEnableRake] = useState(false);
    const [rakeFreeThreshold, setRakeFreeThreshold] = useState("0");
    const [rakePercentage, setRakePercentage] = useState("5");
    const [rakeCap, setRakeCap] = useState("0.10");
    const [rakeOwner, setRakeOwner] = useState("");

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
    const [createdGameAddress, setCreatedGameAddress] = useState<string | null>(null);
    const [tableCountBeforeCreation, setTableCountBeforeCreation] = useState<number>(0);

    const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
    const [cosmosClient] = useState(() => new CosmosClient(getDefaultCosmosConfig()));

    const usdcBalance = useMemo(() => {
        const balance = cosmosWallet.balance.find(b => b.denom === "usdc");
        return balance ? parseInt(balance.amount) : 0;
    }, [cosmosWallet.balance]);

    const usdcBalanceFormatted = (usdcBalance / Math.pow(10, USDC_DECIMALS)).toFixed(6);

    // Paid table name: normalize to the chain's canonical form so the
    // preview, fee, validation and submitted value all match the chain.
    const normalizedTableName = useMemo(() => normalizeTableName(tableName), [tableName]);
    const tableNameError = useMemo(() => validateTableName(tableName), [tableName]);
    const tableNameFeeUsd = useMemo(() => microToUsdc(computeGameNameFee(normalizedTableName)), [normalizedTableName]);

    // Table creation fee = 10 big blinds, priced from the
    // exact values handleCreateTable submits. null = the chain could not price it.
    const creationFeeMicro = useMemo(
        () =>
            computeTableCreationFeeMicro(
                gameFormat,
                parseFloat(smallBlind),
                parseFloat(bigBlind),
                isTournamentFormat(gameFormat) ? parseFloat(tournamentBuyIn) : calculatedMinBuyIn,
                isTournamentFormat(gameFormat) ? startingStack : undefined
            ),
        [gameFormat, smallBlind, bigBlind, tournamentBuyIn, calculatedMinBuyIn, startingStack]
    );
    const creationFeeFormatted = creationFeeMicro === null ? "—" : formatMicroAsUsdc(creationFeeMicro.toString(), 6);
    const totalCostMicro = creationFeeMicro === null ? null : creationFeeMicro + computeGameNameFee(normalizedTableName);
    const totalCostFormatted = totalCostMicro === null ? "—" : formatMicroAsUsdc(totalCostMicro.toString(), 6);
    // Enough for the creation fee AND any name fee — the chain debits both.
    const hasEnoughUsdc = totalCostMicro !== null && BigInt(usdcBalance) >= totalCostMicro;
    const insufficientForName = totalCostMicro !== null && normalizedTableName.length > 0 && BigInt(usdcBalance) < totalCostMicro;

    const tables: TableData[] = useMemo(() => {
        const mappedTables = fetchedGames.map((game) => ({
            gameId: game.gameId,
            gameFormat: getGameFormat(game.gameFormat),
            minPlayers: game.minPlayers,
            maxPlayers: game.maxPlayers,
            currentPlayers: game.currentPlayers,
            minBuyIn: game.minBuyIn,
            maxBuyIn: game.maxBuyIn,
            smallBlind: game.smallBlind,
            bigBlind: game.bigBlind,
            timeout: game.timeout,
            status: game.status,
            creator: game.creator,
            createdAt: game.createdAt
        }));

        // Sort by available seats (least empty seats first, full tables last)
        return sortTablesByAvailableSeats(mappedTables);
    }, [fetchedGames]);

    const handleCreateTable = async () => {

        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        const rakeConfig = enableRake ? {
            rakeFreeThreshold: parseFloat(rakeFreeThreshold),
            rakePercentage: parseFloat(rakePercentage),
            rakeCap: parseFloat(rakeCap),
            owner: rakeOwner || cosmosWallet.address || ""
        } : undefined;

        // For tournaments, use fixed buy-in; for cash games, use BB-calculated values
        const isTournament = isTournamentFormat(gameFormat);
        const finalMinBuyIn = isTournament ? parseFloat(tournamentBuyIn) : calculatedMinBuyIn;
        const finalMaxBuyIn = isTournament ? parseFloat(tournamentBuyIn) : calculatedMaxBuyIn;

        const sngConfig = isTournament ? {
            startingStack,
            blindLevelDuration,
            entryFee: parseFloat(entryFee) || 0
        } : undefined;

        // Store the table count before creating to verify a new table was added
        setTableCountBeforeCreation(tables.length);
        
        try {
            // SNG requires fixed entrant count (min_players == max_players).
            const finalMinPlayers = isTournament ? maxPlayers : minPlayers;

            const result = await createTable({
                format: gameFormat,
                minBuyIn: finalMinBuyIn,
                maxBuyIn: finalMaxBuyIn,
                minPlayers: finalMinPlayers,
                maxPlayers,
                smallBlind: parseFloat(smallBlind),
                bigBlind: parseFloat(bigBlind),
                name: normalizedTableName || undefined,
                ...(rakeConfig && { rake: rakeConfig }),
                ...(sngConfig && { sng: sngConfig })
            });


            if (result) {
                setSuccessTxHash(result.txHash);
                setCreatedGameAddress(result.gameId);
                setShowSuccessModal(true);
                setTableName("");
                // The chain just debited the creation (+ name) fee — show the real balance.
                void cosmosWallet.refreshBalance();

                // Wait a moment then reload tables
                setTimeout(() => {
                    refetch();
                }, 2000);
            } else {
                toast.error("Table creation failed - no transaction hash returned");
            }
        } catch (err: unknown) {
            console.error("❌ Failed to create table:", err);
            const error = err instanceof Error ? err : new Error("Unknown error");
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            toast.error(`Failed to create table: ${error.message}`);
        }
    };

    // Fetch player counts for all tables - only runs once when tables are first loaded
    // Use a ref to track table IDs to prevent duplicate requests
    const tableIdsRef = useRef<string>("");

    useEffect(() => {
        // Create a stable key from table IDs to detect actual changes
        const currentTableIds = tables.map(t => t.gameId).join(",");

        // Only fetch if tables changed (not just reference equality)
        if (isEmpty(tables) || currentTableIds === tableIdsRef.current) {
            return;
        }

        tableIdsRef.current = currentTableIds;

        const fetchPlayerCounts = async () => {
            const counts: Record<string, number> = {};

            for (const table of tables) {
                try {
                    const gameStateResponse = await cosmosClient.getGameState(table.gameId);
                    if (gameStateResponse && gameStateResponse.game_state) {
                        const gameState = JSON.parse(gameStateResponse.game_state);
                        // Count players with valid addresses (seated players)
                        // Filter out empty seats using the utility function
                        const seatedPlayers = gameState.players?.filter((p: PlayerDTO | null) =>
                            p !== null && isValidPlayerAddress(p.address)
                        ).length || 0;
                        counts[table.gameId] = seatedPlayers;
                    }
                } catch (err) {
                    console.error(`Failed to fetch game state for ${table.gameId}:`, err);
                    // If we can't fetch game state, default to 0
                    counts[table.gameId] = 0;
                }
            }

            setPlayerCounts(counts);
        };

        fetchPlayerCounts();
    }, [tables, cosmosClient]);

    useEffect(() => {
        if (createError) {
            toast.error(createError.message);
        }
        if (gamesError) {
            toast.error(`Failed to load games: ${gamesError.message}`);
        }
    }, [createError, gamesError]);


    const totalTables = tables.length;
    const activeTables = tables.filter(t => t.status === "playing" || t.status === "waiting").length;
    const sitAndGoTables = tables.filter(t => t.maxPlayers <= 6).length;

    const labelCls = "block text-xs uppercase tracking-[0.08em] text-ink-muted mb-1.5";
    const inputCls =
        "w-full h-11 px-3.5 rounded-xl bg-surface-raised border border-line-strong text-ink text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50";
    const hintCls = "text-ink-muted text-xs mt-1.5";
    const subCardCls = "bg-surface-raised rounded-xl px-4 py-3";

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
                <div>
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Table Admin Dashboard</h1>
                    <p className="mt-1 mb-0 text-ink-muted">Create and manage poker tables</p>
                </div>

                <StatStrip
                    items={[
                        { label: "Total Tables", value: totalTables },
                        { label: "Active Tables", value: activeTables, tone: "good" },
                        { label: "Sit & Go Tables", value: sitAndGoTables }
                    ]}
                />

                <Card>
                    <CardHeader
                        title="Create New Table"
                        actions={
                            cosmosWallet.address ? (
                                <div className="text-right">
                                    <p className="m-0 text-ink-muted text-xs">Your USDC Balance</p>
                                    <p className={`m-0 text-base font-semibold tabular-nums ${hasEnoughUsdc ? "text-ink" : "text-red-400"}`}>
                                        ${usdcBalanceFormatted} USDC
                                    </p>
                                </div>
                            ) : undefined
                        }
                    />
                    <div className="p-5 flex flex-col gap-5">
                        <div className={`${subCardCls} flex flex-wrap items-center justify-between gap-2`}>
                            <span className="text-ink-muted text-sm">Table Creation Fee ({CREATION_FEE_BIG_BLINDS.toString()} big blinds):</span>
                            <span className="text-ink font-mono tabular-nums text-sm">{creationFeeFormatted} USDC</span>
                        </div>

                        <div>
                            <label className={labelCls}>
                                Table Name <span className="normal-case tracking-normal">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={tableName}
                                onChange={e => setTableName(e.target.value)}
                                placeholder="e.g. friday-degens"
                                className={inputCls}
                            />
                            {tableNameError ? (
                                <p className="text-xs text-red-400 mt-1.5">{tableNameError}</p>
                            ) : normalizedTableName.length > 0 ? (
                                <p className={hintCls}>
                                    {tableNameCharCount(normalizedTableName)} characters × $0.10 ={" "}
                                    <span className="text-ink font-semibold">${tableNameFeeUsd.toFixed(2)}</span>
                                    {normalizedTableName !== tableName && (
                                        <span className="text-ink-muted"> — saved as “{normalizedTableName}”</span>
                                    )}
                                    {insufficientForName && (
                                        <span className="text-red-400"> — exceeds your ${usdcBalanceFormatted} balance</span>
                                    )}
                                </p>
                            ) : (
                                <p className={hintCls}>Free if left blank. Lowercase a–z, 0–9 and hyphens; $0.10 per character.</p>
                            )}
                        </div>

                        {cosmosWallet.address && !hasEnoughUsdc && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="min-w-0">
                                        <p className="m-0 text-red-300 font-semibold mb-1">Insufficient USDC Balance</p>
                                        <p className="m-0 text-ink-soft text-sm mb-3">
                                            You need {totalCostFormatted} USDC to create this table ({CREATION_FEE_BIG_BLINDS.toString()} big blinds
                                            {normalizedTableName.length > 0 ? " plus the name fee" : ""}).
                                            Your current balance is ${usdcBalanceFormatted} USDC.
                                        </p>
                                        <Link to="/" className={pillClass("primary", "md", "w-full sm:w-auto")}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m0-16l-4 4m4-4l4 4" />
                                            </svg>
                                            Deposit USDC from Ethereum
                                        </Link>
                                        <p className="m-0 text-ink-muted text-xs mt-3">
                                            Go to Dashboard → Bridge Deposit to transfer USDC from Ethereum to your poker account
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="table-game-type" className={labelCls}>Game Type</label>
                                <Select
                                    id="table-game-type"
                                    aria-label="Game Type"
                                    value={gameFormat}
                                    onChange={next => {
                                        const format = toGameFormat(next);
                                        if (format) handleGameFormatChange(format);
                                    }}
                                    options={[
                                        { value: GameFormat.SIT_AND_GO, label: "Sit & Go" },
                                        { value: GameFormat.TOURNAMENT, label: "Tournament" },
                                        { value: GameFormat.CASH, label: "Cash Game" }
                                    ]}
                                />
                            </div>
                            <div>
                                <label htmlFor="table-max-players" className={labelCls}>Max Players</label>
                                <Select
                                    id="table-max-players"
                                    aria-label="Max Players"
                                    value={String(maxPlayers)}
                                    onChange={next => setMaxPlayers(parseInt(next))}
                                    options={[
                                        { value: "2", label: "2 (Heads-Up)" },
                                        { value: "4", label: "4 (Sit & Go)" },
                                        { value: "6", label: "6 (Sit & Go)" },
                                        { value: "9", label: "9 (Full Ring)" }
                                    ]}
                                />
                            </div>

                            {gameFormat === GameFormat.CASH && (
                                <div className="md:col-span-2">
                                    <label htmlFor="table-game-size" className={labelCls}>Game Size (Small Blind / Big Blind)</label>
                                    <Select
                                        id="table-game-size"
                                        aria-label="Game Size (Small Blind / Big Blind)"
                                        value={String(selectedBlindLevel)}
                                        onChange={next => setSelectedBlindLevel(Number(next))}
                                        options={BLIND_LEVELS.map((level, index) => ({ value: String(index), label: level.label }))}
                                    />
                                </div>
                            )}
                        </div>

                        {isTournamentFormat(gameFormat) ? (
                            <div className="flex flex-col gap-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Buy In ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={tournamentBuyIn}
                                            onChange={e => setTournamentBuyIn(e.target.value)}
                                            className={inputCls}
                                            placeholder="e.g., 10.00"
                                        />
                                        <p className={hintCls}>All players pay the same buy in</p>
                                    </div>

                                    <div>
                                        <label className={labelCls}>Entry Fee ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={entryFee}
                                            onChange={e => setEntryFee(e.target.value)}
                                            className={inputCls}
                                            placeholder="e.g., 0.50"
                                        />
                                        <p className={hintCls}>Flat fee to the creator on top of the buy in — 0 for none</p>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Starting Stack (chips)</label>
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        <ChoicePill selected={startingStack === 1000} onClick={() => setStartingStack(1000)}>
                                            Turbo (1000)
                                        </ChoicePill>
                                        <ChoicePill selected={startingStack === 1500} onClick={() => setStartingStack(1500)}>
                                            Standard (1500)
                                        </ChoicePill>
                                        <ChoicePill selected={startingStack === 3000} onClick={() => setStartingStack(3000)}>
                                            Deep Stack (3000)
                                        </ChoicePill>
                                    </div>
                                    <input
                                        type="number"
                                        min="100"
                                        step="100"
                                        value={startingStack}
                                        onChange={e => setStartingStack(Number(e.target.value))}
                                        className={inputCls}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>Starting Blinds (chips)</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <ChoicePill
                                            selected={sngSmallBlind === 10 && sngBigBlind === 20}
                                            onClick={() => { setSngSmallBlind(10); setSngBigBlind(20); }}
                                        >
                                            10 / 20
                                        </ChoicePill>
                                        <ChoicePill
                                            selected={sngSmallBlind === 25 && sngBigBlind === 50}
                                            onClick={() => { setSngSmallBlind(25); setSngBigBlind(50); }}
                                        >
                                            25 / 50
                                        </ChoicePill>
                                        <ChoicePill
                                            selected={sngSmallBlind === 50 && sngBigBlind === 100}
                                            onClick={() => { setSngSmallBlind(50); setSngBigBlind(100); }}
                                        >
                                            50 / 100
                                        </ChoicePill>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Blind Level Duration</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <ChoicePill selected={blindLevelDuration === 3} onClick={() => setBlindLevelDuration(3)}>
                                            Hyper (3 min)
                                        </ChoicePill>
                                        <ChoicePill selected={blindLevelDuration === 5} onClick={() => setBlindLevelDuration(5)}>
                                            Turbo (5 min)
                                        </ChoicePill>
                                        <ChoicePill selected={blindLevelDuration === 10} onClick={() => setBlindLevelDuration(10)}>
                                            Standard (10 min)
                                        </ChoicePill>
                                        <ChoicePill selected={blindLevelDuration === 15} onClick={() => setBlindLevelDuration(15)}>
                                            Deep (15 min)
                                        </ChoicePill>
                                    </div>
                                </div>

                                <div className={subCardCls}>
                                    <p className="m-0 text-ink-muted text-xs mb-1">SNG Settings:</p>
                                    <p className="m-0 text-emerald-400 text-sm font-medium">
                                        {startingStack} chips • Blinds increase every {blindLevelDuration} min
                                    </p>
                                    <p className="m-0 text-ink-muted text-xs mt-1">
                                        Starting blinds: {sngSmallBlind} / {sngBigBlind} chips
                                    </p>
                                </div>

                                <PillButton variant="outline" size="md" className="w-full" onClick={() => setShowAdvancedModal(true)}>
                                    <span>⚙</span>
                                    Advanced Options (Custom Params)
                                </PillButton>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5">
                                <div>
                                    <label className={labelCls}>Buy-In Presets</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <ChoicePill
                                            selected={minBuyInBB === 20 && maxBuyInBB === 100}
                                            onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.STANDARD.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.STANDARD.maxBuyInBB); }}
                                        >
                                            Standard (20-100 BB)
                                        </ChoicePill>
                                        <ChoicePill
                                            selected={minBuyInBB === 40 && maxBuyInBB === 200}
                                            onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.DEEP.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.DEEP.maxBuyInBB); }}
                                        >
                                            Deep (40-200 BB)
                                        </ChoicePill>
                                        <ChoicePill
                                            selected={minBuyInBB === 100 && maxBuyInBB === 300}
                                            onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.DEEP_STACK.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.DEEP_STACK.maxBuyInBB); }}
                                        >
                                            Deep Stack (100-300 BB)
                                        </ChoicePill>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Min Buy-In (BB)</label>
                                        <input
                                            type="number"
                                            min="20"
                                            max="500"
                                            value={minBuyInBB}
                                            onChange={e => setMinBuyInBB(Number(e.target.value))}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Max Buy-In (BB)</label>
                                        <input
                                            type="number"
                                            min="20"
                                            max="500"
                                            value={maxBuyInBB}
                                            onChange={e => setMaxBuyInBB(Number(e.target.value))}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>

                                {parseFloat(bigBlind) > 0 && (
                                    <div className={subCardCls}>
                                        <p className="m-0 text-ink-muted text-xs mb-1">Calculated Buy-In Range:</p>
                                        <p className="m-0 text-emerald-400 text-sm font-medium tabular-nums">
                                            ${calculatedMinBuyIn.toFixed(2)} - ${calculatedMaxBuyIn.toFixed(2)}
                                        </p>
                                        <p className="m-0 text-ink-muted text-xs mt-1">
                                            Based on ${parseFloat(bigBlind).toFixed(2)} BB
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {isTournamentFormat(gameFormat) && (
                            <div>
                                <div className="flex items-center gap-2.5 min-h-[44px]">
                                    <input
                                        type="checkbox"
                                        id="showStructure"
                                        checked={showStructure}
                                        onChange={e => setShowStructure(e.target.checked)}
                                        className="w-4 h-4 accent-brand"
                                    />
                                    <label htmlFor="showStructure" className="text-ink-body text-sm font-medium cursor-pointer">
                                        Show Blind Structure
                                    </label>
                                </div>

                                {showStructure && (
                                    <div className="border border-line rounded-xl p-4 mt-2 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-ink-muted text-xs uppercase tracking-[0.08em] border-b border-line">
                                                    <th className="text-left font-medium py-2 px-2">Level</th>
                                                    <th className="text-left font-medium py-2 px-2">Small Blind</th>
                                                    <th className="text-left font-medium py-2 px-2">Big Blind</th>
                                                    <th className="text-left font-medium py-2 px-2">Duration</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-ink-soft tabular-nums">
                                                {Array.from({ length: 10 }, (_, i) => {
                                                    const sb = parseInt(smallBlind) || 25;
                                                    const bb = parseInt(bigBlind) || 50;
                                                    const levelSB = sb * Math.pow(2, i);
                                                    const levelBB = bb * Math.pow(2, i);
                                                    return (
                                                        <tr key={i} className={i === 0 ? "bg-emerald-500/10" : ""}>
                                                            <td className="py-2 px-2">{i + 1}</td>
                                                            <td className="py-2 px-2">{levelSB.toLocaleString()}</td>
                                                            <td className="py-2 px-2">{levelBB.toLocaleString()}</td>
                                                            <td className="py-2 px-2">{blindLevelDuration} min</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <p className="m-0 text-ink-muted text-xs mt-3">
                                            * Blinds double each level. Level 1 is highlighted.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-2.5 min-h-[44px]">
                                <input
                                    type="checkbox"
                                    id="enableRake"
                                    checked={enableRake && gameFormat === GameFormat.CASH}
                                    onChange={e => setEnableRake(e.target.checked)}
                                    disabled={gameFormat !== GameFormat.CASH}
                                    className="w-4 h-4 accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <label htmlFor="enableRake" className={`text-sm font-medium ${gameFormat === GameFormat.CASH ? "text-ink-body cursor-pointer" : "text-ink-muted"}`}>
                                    Enable Rake Collection {gameFormat !== GameFormat.CASH && "(Cash games only)"}
                                </label>
                            </div>

                            {enableRake && gameFormat === GameFormat.CASH && (
                                <div className="border border-line rounded-xl p-4 mt-2 flex flex-col gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Rake-Free Threshold (USDC)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={rakeFreeThreshold}
                                                onChange={e => setRakeFreeThreshold(e.target.value)}
                                                className={inputCls}
                                                placeholder="0 = rake all pots"
                                            />
                                            <p className={hintCls}>Pots below this amount are rake-free</p>
                                        </div>
                                        <div>
                                            <label htmlFor="table-rake-percentage" className={labelCls}>Rake Percentage (%)</label>
                                            <Select
                                                id="table-rake-percentage"
                                                aria-label="Rake Percentage (%)"
                                                value={rakePercentage}
                                                onChange={setRakePercentage}
                                                options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ value: String(n), label: `${n}%` }))}
                                            />
                                            <p className={hintCls}>Typically 2% - 5%</p>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Rake Cap (USDC)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={rakeCap}
                                                onChange={e => setRakeCap(e.target.value)}
                                                className={inputCls}
                                                placeholder="e.g., 0.10"
                                            />
                                            <p className={hintCls}>Maximum rake per hand</p>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Rake Owner Address</label>
                                            <input
                                                type="text"
                                                value={rakeOwner}
                                                readOnly
                                                placeholder={cosmosWallet.address || "b52..."}
                                                className={`${inputCls} font-mono cursor-not-allowed opacity-70`}
                                            />
                                            <p className={hintCls}>Defaults to your address</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <PillButton
                                size="lg"
                                className="flex-1"
                                onClick={handleCreateTable}
                                disabled={isCreating || !cosmosWallet.address || !hasEnoughUsdc || !!tableNameError || insufficientForName}
                            >
                                {isCreating ? "Creating..." : !hasEnoughUsdc ? "Insufficient USDC" : tableNameError ? "Invalid table name" : "Create Table"}
                            </PillButton>
                            <button
                                type="button"
                                onClick={refetch}
                                disabled={isLoading}
                                className="w-11 h-11 flex-shrink-0 inline-flex items-center justify-center rounded-btn border border-line-strong text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors disabled:opacity-50"
                                title="Refresh tables"
                                aria-label="Refresh tables"
                            >
                                <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </button>
                        </div>

                        {!cosmosWallet.address && (
                            <p className="m-0 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
                                Connect your Block52 wallet to create tables
                            </p>
                        )}
                        {cosmosWallet.address && hasEnoughUsdc && (
                            <p className="m-0 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm">
                                ✓ You have enough USDC to create a table
                            </p>
                        )}
                    </div>
                </Card>

                <TableList />

                <details className="group border border-line rounded-2xl bg-surface-card px-5 py-4">
                    <summary className="cursor-pointer text-ink font-semibold marker:text-ink-muted">ℹ️ How This Works</summary>
                    <ul className="mt-3 mb-0 pl-5 text-ink-soft text-sm leading-relaxed space-y-1 list-disc">
                        <li>Create new poker tables with custom settings (buy-in, blinds, player count)</li>
                        <li>All tables are stored on the blockchain and queryable via REST API</li>
                        <li>Click "Join Table" to enter any available table</li>
                        <li>Tables show real-time player counts and game settings</li>
                        <li>Default setup: Sit & Go, 4 players, Texas Hold'em</li>
                    </ul>
                </details>
            </div>

            <AdvancedSngParamsModal
                isOpen={showAdvancedModal}
                onClose={() => setShowAdvancedModal(false)}
                current={{
                    maxPlayers,
                    buyIn: parseFloat(tournamentBuyIn) || 0,
                    startingStack,
                    smallBlind: sngSmallBlind,
                    bigBlind: sngBigBlind,
                    blindLevelDuration
                }}
                onApply={handleApplyAdvancedParams}
            />

            {showSuccessModal && successTxHash && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 px-4">
                    <div className="bg-surface-card border border-line-strong rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
                        <h2 className="m-0 text-2xl font-semibold text-ink text-center mb-3">Table Created Successfully!</h2>

                        <p className="m-0 text-ink-soft text-center mb-6">Your poker table has been created on the blockchain.</p>

                        <div className="bg-surface-raised rounded-xl p-4 mb-6">
                            <p className="m-0 text-ink-muted text-xs uppercase tracking-[0.08em] mb-2">Transaction Hash:</p>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-brand-light text-xs font-mono break-all">{successTxHash}</code>
                                <button
                                    onClick={() => copyToClipboard(successTxHash, "Transaction hash copied!")}
                                    className="w-11 h-11 inline-flex items-center justify-center rounded-btn text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors flex-shrink-0"
                                    title="Copy transaction hash"
                                    aria-label="Copy transaction hash"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {createdGameAddress && (
                                <a
                                    href={`/table/${createdGameAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={pillClass("primary", "lg", "w-full")}
                                >
                                    Join Table
                                </a>
                            )}
                            <PillButton
                                variant="outline"
                                size="md"
                                className="w-full"
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setSuccessTxHash(null);
                                    setCreatedGameAddress(null);
                                }}
                            >
                                Close
                            </PillButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
