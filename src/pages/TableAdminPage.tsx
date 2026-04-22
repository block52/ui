import { useState, useEffect, useMemo, useRef } from "react";
import { GameFormat, CosmosClient, getDefaultCosmosConfig, PlayerDTO } from "@block52/poker-vm-sdk";
import { Link, useNavigate } from "react-router-dom";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { isValidPlayerAddress } from "../utils/addressUtils";
import { useNewTable } from "../hooks/game/useNewTable";
import { useFindGames } from "../hooks/game/useFindGames";
import { toast } from "react-toastify";
import { formatMicroAsUsdc, USDC_DECIMALS } from "../constants/currency";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import TableList from "../components/TableList";
import { calculateBuyIn, BUY_IN_PRESETS } from "../utils/buyInUtils";
import { sortTablesByAvailableSeats } from "../utils/tableSortingUtils";
import { BLIND_LEVELS, DEFAULT_BLIND_LEVEL_INDEX } from "../constants/blindLevels";
import { isTournamentFormat, getGameFormat } from "../utils/gameFormatUtils";

// Game creation fee in base units (1 usdc = 0.000001 USDC)
// This matches GameCreationCost in pokerchain/x/poker/types/types.go
const GAME_CREATION_FEE_BASE = 1;
const GAME_CREATION_FEE_USDC = GAME_CREATION_FEE_BASE / Math.pow(10, USDC_DECIMALS);

/**
 * TableAdminPage - Admin interface for creating and managing poker tables
 *
 * Features:
 * - Create new poker tables (Sit & Go, Texas Hold'em)
 * - View all tables with their settings
 * - Join tables directly from the dashboard
 */

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

    // Default table settings for Cash Game, 9 players, Texas Hold'em
    const [gameFormat, setGameFormat] = useState<GameFormat>(GameFormat.CASH);
    const [minPlayers] = useState(2);
    const [maxPlayers, setMaxPlayers] = useState(9);
    
    // Selected blind level (index in BLIND_LEVELS array) — cash games only
    const [selectedBlindLevel, setSelectedBlindLevel] = useState(DEFAULT_BLIND_LEVEL_INDEX);

    // SNG/Tournament blind values (in chips, not dollars)
    const [sngSmallBlind, setSngSmallBlind] = useState(25);
    const [sngBigBlind, setSngBigBlind] = useState(50);

    // Get effective blind values based on game format
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
    };
    // Buy-in in Big Blinds (BB) for Cash games
    const [minBuyInBB, setMinBuyInBB] = useState(20);
    const [maxBuyInBB, setMaxBuyInBB] = useState(100);
    // For tournaments: single buy-in amount
    const [tournamentBuyIn, setTournamentBuyIn] = useState("10");
    // SNG/Tournament specific settings
    const [startingStack, setStartingStack] = useState(1500);
    const [blindLevelDuration, setBlindLevelDuration] = useState(10);
    const [showStructure, setShowStructure] = useState(false);

    // Calculate actual buy-in values from BB
    const { minBuyIn: calculatedMinBuyIn, maxBuyIn: calculatedMaxBuyIn } = useMemo(
        () => calculateBuyIn({ minBuyInBB, maxBuyInBB, bigBlind: parseFloat(bigBlind) || 0 }),
        [minBuyInBB, maxBuyInBB, bigBlind]
    );

    // Rake settings (optional)
    const [enableRake, setEnableRake] = useState(false);
    const [rakeFreeThreshold, setRakeFreeThreshold] = useState("0");
    const [rakePercentage, setRakePercentage] = useState("5");
    const [rakeCap, setRakeCap] = useState("0.10");
    const [rakeOwner, setRakeOwner] = useState("");

    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
    const [createdGameAddress, setCreatedGameAddress] = useState<string | null>(null);
    const [tableCountBeforeCreation, setTableCountBeforeCreation] = useState<number>(0);

    // Player counts from game state
    const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
    const [cosmosClient] = useState(() => new CosmosClient(getDefaultCosmosConfig()));

    // Get USDC balance from wallet
    const usdcBalance = useMemo(() => {
        const balance = cosmosWallet.balance.find(b => b.denom === "usdc");
        return balance ? parseInt(balance.amount) : 0;
    }, [cosmosWallet.balance]);

    // Check if user has enough USDC for game creation
    const hasEnoughUsdc = usdcBalance >= GAME_CREATION_FEE_BASE;
    const usdcBalanceFormatted = (usdcBalance / Math.pow(10, USDC_DECIMALS)).toFixed(6);

    // Transform fetched games to TableData format - memoized to prevent infinite loops
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

    // Create a new table using the useNewTable hook
    const handleCreateTable = async () => {

        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        // Build rake config if enabled
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

        // Build SNG config if this is a tournament/SNG
        const sngConfig = isTournament ? {
            startingStack,
            blindLevelDuration
        } : undefined;

        // Store the table count before creating to verify a new table was added
        setTableCountBeforeCreation(tables.length);
        
        try {
            const result = await createTable({
                format: gameFormat,
                minBuyIn: finalMinBuyIn,
                maxBuyIn: finalMaxBuyIn,
                minPlayers,
                maxPlayers,
                smallBlind: parseFloat(smallBlind),
                bigBlind: parseFloat(bigBlind),
                ...(rakeConfig && { rake: rakeConfig }),
                ...(sngConfig && { sng: sngConfig })
            });


            if (result) {
                // Show success modal with transaction link
                setSuccessTxHash(result.txHash);
                // Set the game address immediately if we got it from the transaction
                setCreatedGameAddress(result.gameId);
                setShowSuccessModal(true);

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
        if (tables.length === 0 || currentTableIds === tableIdsRef.current) {
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

    // Show error toast if createError or gamesError changes
    useEffect(() => {
        if (createError) {
            toast.error(createError.message);
        }
        if (gamesError) {
            toast.error(`Failed to load games: ${gamesError.message}`);
        }
    }, [createError, gamesError]);

    // Note: createdGameAddress is now set directly from the transaction response
    // when creating a table, so we no longer need to guess from the sorted tables list

    // Stats
    const totalTables = tables.length;
    const activeTables = tables.filter(t => t.status === "playing" || t.status === "waiting").length;
    const sitAndGoTables = tables.filter(t => t.maxPlayers <= 6).length;

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Table Admin Dashboard</h1>
                    <p className="text-gray-400">Create and manage poker tables</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Total Tables</p>
                        <p className="text-2xl font-bold text-white">{totalTables}</p>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
                        <p className="text-green-400 text-sm mb-1">Active Tables</p>
                        <p className="text-2xl font-bold text-green-300">{activeTables}</p>
                    </div>
                    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                        <p className="text-blue-400 text-sm mb-1">Sit & Go Tables</p>
                        <p className="text-2xl font-bold text-blue-300">{sitAndGoTables}</p>
                    </div>
                </div>

                {/* Create Table Form */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold text-white">Create New Table</h2>
                        {cosmosWallet.address && (
                            <div className="text-right">
                                <p className="text-gray-400 text-xs">Your USDC Balance</p>
                                <p className={`text-lg font-bold ${hasEnoughUsdc ? "text-green-400" : "text-red-400"}`}>
                                    ${usdcBalanceFormatted} USDC
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Creation Fee Info */}
                    <div className="bg-gray-900 rounded-lg p-3 mb-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Table Creation Fee:</span>
                            <span className="text-white font-mono text-sm">{GAME_CREATION_FEE_USDC.toFixed(6)} USDC</span>
                        </div>
                    </div>

                    {/* Insufficient USDC Warning */}
                    {cosmosWallet.address && !hasEnoughUsdc && (
                        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                                <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className="text-red-300 font-semibold mb-1">Insufficient USDC Balance</p>
                                    <p className="text-red-400/80 text-sm mb-3">
                                        You need at least {GAME_CREATION_FEE_USDC.toFixed(6)} USDC to create a table.
                                        Your current balance is ${usdcBalanceFormatted} USDC.
                                    </p>
                                    <Link
                                        to="/"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m0-16l-4 4m4-4l4 4" />
                                        </svg>
                                        Deposit USDC from Ethereum
                                    </Link>
                                    <p className="text-gray-500 text-xs mt-2">
                                        Go to Dashboard → Bridge Deposit to transfer USDC from Ethereum to your poker account
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-gray-300 text-xs mb-1 block">Game Type</label>
                            <select
                                value={gameFormat}
                                onChange={e => handleGameFormatChange(e.target.value as GameFormat)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                            >
                                <option value={GameFormat.SIT_AND_GO}>Sit & Go</option>
                                <option value={GameFormat.TOURNAMENT}>Tournament</option>
                                <option value={GameFormat.CASH}>Cash Game</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-gray-300 text-xs mb-1 block">Max Players</label>
                            <select
                                value={maxPlayers}
                                onChange={e => setMaxPlayers(parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                            >
                                <option value={2}>2 (Heads-Up)</option>
                                <option value={4}>4 (Sit & Go)</option>
                                <option value={6}>6 (Sit & Go)</option>
                                <option value={9}>9 (Full Ring)</option>
                            </select>
                        </div>
                    </div>

                    {/* Blinds Dropdown - Cash games only */}
                    {gameFormat === GameFormat.CASH && (
                        <div className="mb-3">
                            <label className="text-gray-300 text-xs mb-1 block">
                                Game Size (Small Blind / Big Blind)
                            </label>
                            <select
                                value={selectedBlindLevel}
                                onChange={e => setSelectedBlindLevel(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                            >
                                {BLIND_LEVELS.map((level, index) => (
                                    <option key={index} value={index}>
                                        {level.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Buy-In Section */}
                    <div className="mb-4">
                        {isTournamentFormat(gameFormat) ? (
                            <div className="space-y-4">
                                {/* Buy In */}
                                <div>
                                    <label className="text-gray-300 text-xs mb-1 block">Buy In ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={tournamentBuyIn}
                                        onChange={e => setTournamentBuyIn(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                        placeholder="e.g., 10.00"
                                    />
                                    <p className="text-gray-500 text-xs mt-1">All players pay the same buy in</p>
                                </div>

                                {/* Starting Stack */}
                                <div>
                                    <label className="text-gray-300 text-xs mb-2 block">Starting Stack (chips)</label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setStartingStack(1000)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                startingStack === 1000
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Turbo (1000)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStartingStack(1500)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                startingStack === 1500
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Standard (1500)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStartingStack(3000)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                startingStack === 3000
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Deep Stack (3000)
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        min="100"
                                        step="100"
                                        value={startingStack}
                                        onChange={e => setStartingStack(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                    />
                                </div>

                                {/* Starting Blinds (chips) */}
                                <div>
                                    <label className="text-gray-300 text-xs mb-2 block">Starting Blinds (chips)</label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSngSmallBlind(10); setSngBigBlind(20); }}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                sngSmallBlind === 10 && sngBigBlind === 20
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            10 / 20
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSngSmallBlind(25); setSngBigBlind(50); }}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                sngSmallBlind === 25 && sngBigBlind === 50
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            25 / 50
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSngSmallBlind(50); setSngBigBlind(100); }}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                sngSmallBlind === 50 && sngBigBlind === 100
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            50 / 100
                                        </button>
                                    </div>
                                </div>

                                {/* Blind Level Duration */}
                                <div>
                                    <label className="text-gray-300 text-xs mb-2 block">Blind Level Duration</label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setBlindLevelDuration(3)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                blindLevelDuration === 3
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Hyper (3 min)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBlindLevelDuration(5)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                blindLevelDuration === 5
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Turbo (5 min)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBlindLevelDuration(10)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                blindLevelDuration === 10
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Standard (10 min)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBlindLevelDuration(15)}
                                            className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                                blindLevelDuration === 15
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Deep (15 min)
                                        </button>
                                    </div>
                                </div>

                                {/* SNG Settings Summary */}
                                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                                    <p className="text-gray-400 text-xs mb-1">SNG Settings:</p>
                                    <p className="text-green-400 text-sm font-medium">
                                        {startingStack} chips • Blinds increase every {blindLevelDuration} min
                                    </p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        Starting blinds: {sngSmallBlind} / {sngBigBlind} chips
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Buy-In Presets */}
                                <label className="text-gray-300 text-xs mb-2 block">Buy-In Presets</label>
                                <div className="flex gap-2 flex-wrap mb-3">
                                    <button
                                        type="button"
                                        onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.STANDARD.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.STANDARD.maxBuyInBB); }}
                                        className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                            minBuyInBB === 20 && maxBuyInBB === 100
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                        }`}
                                    >
                                        Standard (20-100 BB)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.DEEP.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.DEEP.maxBuyInBB); }}
                                        className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                            minBuyInBB === 40 && maxBuyInBB === 200
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                        }`}
                                    >
                                        Deep (40-200 BB)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMinBuyInBB(BUY_IN_PRESETS.DEEP_STACK.minBuyInBB); setMaxBuyInBB(BUY_IN_PRESETS.DEEP_STACK.maxBuyInBB); }}
                                        className={`px-3 py-1.5 text-xs rounded transition-all duration-200 ${
                                            minBuyInBB === 100 && maxBuyInBB === 300
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                        }`}
                                    >
                                        Deep Stack (100-300 BB)
                                    </button>
                                </div>

                                {/* Buy-In BB Inputs */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Min Buy-In (BB)</label>
                                        <input
                                            type="number"
                                            min="20"
                                            max="500"
                                            value={minBuyInBB}
                                            onChange={e => setMinBuyInBB(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Max Buy-In (BB)</label>
                                        <input
                                            type="number"
                                            min="20"
                                            max="500"
                                            value={maxBuyInBB}
                                            onChange={e => setMaxBuyInBB(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Calculated Preview */}
                                {parseFloat(bigBlind) > 0 && (
                                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                                        <p className="text-gray-400 text-xs mb-1">Calculated Buy-In Range:</p>
                                        <p className="text-green-400 text-sm font-medium">
                                            ${calculatedMinBuyIn.toFixed(2)} - ${calculatedMaxBuyIn.toFixed(2)}
                                        </p>
                                        <p className="text-gray-500 text-xs mt-1">
                                            Based on ${parseFloat(bigBlind).toFixed(2)} BB
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Show Structure Section - Only for SNG/Tournament */}
                    {isTournamentFormat(gameFormat) && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="showStructure"
                                    checked={showStructure}
                                    onChange={e => setShowStructure(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="showStructure" className="text-gray-300 text-sm font-medium">
                                    Show Blind Structure
                                </label>
                            </div>

                            {showStructure && (
                                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-400 border-b border-gray-700">
                                                <th className="text-left py-2 px-2">Level</th>
                                                <th className="text-left py-2 px-2">Small Blind</th>
                                                <th className="text-left py-2 px-2">Big Blind</th>
                                                <th className="text-left py-2 px-2">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300">
                                            {Array.from({ length: 10 }, (_, i) => {
                                                const sb = parseInt(smallBlind) || 25;
                                                const bb = parseInt(bigBlind) || 50;
                                                const levelSB = sb * Math.pow(2, i);
                                                const levelBB = bb * Math.pow(2, i);
                                                return (
                                                    <tr key={i} className={i === 0 ? "bg-green-900/20" : ""}>
                                                        <td className="py-2 px-2">{i + 1}</td>
                                                        <td className="py-2 px-2">{levelSB.toLocaleString()}</td>
                                                        <td className="py-2 px-2">{levelBB.toLocaleString()}</td>
                                                        <td className="py-2 px-2">{blindLevelDuration} min</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <p className="text-gray-500 text-xs mt-3">
                                        * Blinds double each level. Level 1 is highlighted.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rake Configuration Section - Only for Cash Games */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="checkbox"
                                id="enableRake"
                                checked={enableRake && gameFormat === GameFormat.CASH}
                                onChange={e => setEnableRake(e.target.checked)}
                                disabled={gameFormat !== GameFormat.CASH}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <label htmlFor="enableRake" className={`text-sm font-medium ${gameFormat === GameFormat.CASH ? "text-gray-300" : "text-gray-500"}`}>
                                Enable Rake Collection {gameFormat !== GameFormat.CASH && "(Cash games only)"}
                            </label>
                        </div>

                        {enableRake && gameFormat === GameFormat.CASH && (
                            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Rake-Free Threshold (USDC)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rakeFreeThreshold}
                                            onChange={e => setRakeFreeThreshold(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                            placeholder="0 = rake all pots"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Pots below this amount are rake-free</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Rake Percentage (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={rakePercentage}
                                            onChange={e => setRakePercentage(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                            placeholder="e.g., 5"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Typically 2.5% - 5%</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Rake Cap (USDC)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rakeCap}
                                            onChange={e => setRakeCap(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                            placeholder="e.g., 0.10"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Maximum rake per hand</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-300 text-xs mb-1 block">Rake Owner Address</label>
                                        <input
                                            type="text"
                                            value={rakeOwner}
                                            onChange={e => setRakeOwner(e.target.value)}
                                            placeholder={cosmosWallet.address || "b52..."}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm font-mono"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Defaults to your address</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleCreateTable}
                            disabled={isCreating || !cosmosWallet.address || !hasEnoughUsdc}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                            {isCreating ? "Creating..." : !hasEnoughUsdc ? "Insufficient USDC" : "Create Table"}
                        </button>
                        <button
                            onClick={refetch}
                            disabled={isLoading}
                            className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                            title="Refresh tables"
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

                    {!cosmosWallet.address && <p className="mt-2 text-yellow-400 text-xs">Connect your Block52 wallet to create tables</p>}
                    {cosmosWallet.address && hasEnoughUsdc && (
                        <p className="mt-2 text-green-400 text-xs">
                            ✓ You have enough USDC to create a table
                        </p>
                    )}
                </div>

                {/* Tables List */}
                <TableList />

                {/* Info Box */}
                <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <h3 className="text-blue-200 font-semibold mb-2">ℹ️ How This Works</h3>
                    <ul className="text-blue-300 text-sm space-y-1 list-disc list-inside">
                        <li>Create new poker tables with custom settings (buy-in, blinds, player count)</li>
                        <li>All tables are stored on the blockchain and queryable via REST API</li>
                        <li>Click "Join Table" to enter any available table</li>
                        <li>Tables show real-time player counts and game settings</li>
                        <li>Default setup: Sit & Go, 4 players, Texas Hold'em</li>
                    </ul>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && successTxHash && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="bg-gray-800 border border-blue-500 rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white text-center mb-4">Table Created Successfully!</h2>

                        <p className="text-gray-300 text-center mb-6">Your poker table has been created on the blockchain.</p>

                        <div className="bg-gray-900 rounded-lg p-4 mb-6">
                            <p className="text-gray-400 text-sm mb-2">Transaction Hash:</p>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-blue-400 text-xs font-mono break-all">{successTxHash}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(successTxHash);
                                        toast.success("Transaction hash copied!");
                                    }}
                                    className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                    title="Copy transaction hash"
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
                                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg transition-colors text-center"
                                >
                                    Join Table
                                </a>
                            )}
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setSuccessTxHash(null);
                                    setCreatedGameAddress(null);
                                }}
                                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-50 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
