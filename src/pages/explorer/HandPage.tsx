import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { TexasHoldemStateDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { useNetwork } from "../../context/NetworkContext";
import { getCardImageUrl, getCardBackUrl, getDealerImageUrl } from "../../utils/cardImages";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import styles from "./HandPage.module.css";

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || "https://indexer.block52.xyz";

// ---- Types ----

interface HandData {
    game_id: string;
    hand_number: number;
    block_height: number;
    deck_seed: string;
    deck: string;
    tx_hash: string;
    created_at: string;
}

interface HandsResponse {
    data: HandData[];
    pagination: { limit: number; offset: number; total: number };
}

// ---- Helpers ----

function truncateAddress(addr: string): string {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatStack(stack: string): string {
    return `$${formatUSDCToSimpleDollars(stack)}`;
}

function formatPot(pot: string): string {
    return `$${formatUSDCToSimpleDollars(pot)}`;
}

function statusLabel(status: string): string {
    switch (status) {
        case "active": return "";
        case "folded": return "FOLDED";
        case "all-in": return "ALL IN";
        case "busted": return "BUSTED";
        case "sitting-out": return "SITTING OUT";
        default: return status.toUpperCase();
    }
}

// ---- Seat positions for a 9-max table (percentages) ----
// Arranged oval: seat 1 at bottom-center, going clockwise
const SEAT_POSITIONS: Record<number, { top: string; left: string }> = {
    1: { top: "78%", left: "50%" },
    2: { top: "68%", left: "15%" },
    3: { top: "38%", left: "5%" },
    4: { top: "10%", left: "18%" },
    5: { top: "2%", left: "50%" },
    6: { top: "10%", left: "82%" },
    7: { top: "38%", left: "95%" },
    8: { top: "68%", left: "85%" },
    9: { top: "78%", left: "50%" }, // fallback, will offset if seat 1 also present
};

function getSeatPosition(seat: number, totalSeats: number, allSeats: number[]): { top: string; left: string } {
    if (totalSeats <= 2) {
        // 2-player: bottom and top
        const idx = allSeats.indexOf(seat);
        if (idx === 0) return { top: "75%", left: "50%" };
        return { top: "8%", left: "50%" };
    }
    // For 9-max, distribute occupied seats evenly around the oval
    if (allSeats.length <= 4) {
        const positions4 = [
            { top: "75%", left: "50%" },
            { top: "35%", left: "8%" },
            { top: "5%", left: "50%" },
            { top: "35%", left: "92%" },
        ];
        const idx = allSeats.indexOf(seat);
        return positions4[idx] || SEAT_POSITIONS[seat] || { top: "50%", left: "50%" };
    }
    return SEAT_POSITIONS[seat] || { top: "50%", left: "50%" };
}

// ---- Components ----

function PlayerCard({ player, isDealer }: { player: PlayerDTO; isDealer: boolean }) {
    const isFolded = player.status === "folded";
    const isBusted = player.status === "busted";
    const dimmed = isFolded || isBusted;
    const hasHoleCards = player.holeCards && player.holeCards.length > 0;

    return (
        <div className={`${styles.playerCard} ${dimmed ? styles.playerDimmed : ""}`}>
            {/* Dealer chip */}
            {isDealer && (
                <div className={styles.dealerChip}>
                    <img src={getDealerImageUrl()} alt="D" className="w-5 h-5" />
                </div>
            )}

            {/* Hole cards */}
            {hasHoleCards && (
                <div className={styles.holeCards}>
                    {player.holeCards!.map((card, i) => (
                        <img
                            key={i}
                            src={card === "X" || card === "??" ? getCardBackUrl("default") : getCardImageUrl(card)}
                            alt={card}
                            className={styles.holeCard}
                        />
                    ))}
                </div>
            )}

            {/* Player info */}
            <div className={styles.playerInfo}>
                <span className={styles.playerAddress}>{truncateAddress(player.address)}</span>
                <span className={styles.playerStack}>{formatStack(player.stack)}</span>
                {player.sumOfBets && player.sumOfBets !== "0" && (
                    <span className={styles.playerBet}>Bet: {formatStack(player.sumOfBets)}</span>
                )}
            </div>

            {/* Status badge */}
            {statusLabel(player.status) && (
                <div className={`${styles.statusBadge} ${styles[`status_${player.status.replace("-", "_")}`] || ""}`}>
                    {statusLabel(player.status)}
                </div>
            )}
        </div>
    );
}

function ReadOnlyTable({ gameState, handData }: { gameState: TexasHoldemStateDTO; handData?: HandData }) {
    const activePlayers = gameState.players.filter(p => {
        if (!p.address) return false;
        // Filter out zero/null addresses (hex or bech32)
        if (/^0x0+$/.test(p.address)) return false;
        if (p.address === "b521qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6qtnh3") return false;
        return true;
    });
    const allSeats = activePlayers.map(p => p.seat).sort((a, b) => a - b);
    const totalSeats = allSeats.length;

    const communityCards = gameState.communityCards || [];
    const totalPot = gameState.totalPot || "0";
    const mainPot = gameState.pots?.[0] || "0";

    return (
        <div className={styles.tableContainer}>
            {/* Felt surface */}
            <div className={styles.tableFelt}>
                {/* Hand info badge */}
                <div className={styles.handBadge}>
                    <span>Hand #{gameState.handNumber}</span>
                    {gameState.round && <span className={styles.roundBadge}>{gameState.round.toUpperCase()}</span>}
                </div>

                {/* Pot display */}
                {totalPot !== "0" && (
                    <div className={styles.potArea}>
                        <div className={styles.potLabel}>
                            Pot: <span className={styles.potValue}>{formatPot(totalPot)}</span>
                        </div>
                        {mainPot !== totalPot && mainPot !== "0" && (
                            <div className={styles.mainPotLabel}>
                                Main: {formatPot(mainPot)}
                            </div>
                        )}
                    </div>
                )}

                {/* Community cards */}
                <div className={styles.communityCards}>
                    {Array.from({ length: 5 }).map((_, idx) => {
                        if (idx < communityCards.length) {
                            const card = communityCards[idx];
                            return (
                                <img
                                    key={idx}
                                    src={getCardImageUrl(card)}
                                    alt={card}
                                    className={styles.communityCard}
                                />
                            );
                        }
                        return (
                            <div key={idx} className={styles.communityCardPlaceholder} />
                        );
                    })}
                </div>

                {/* Players around the table */}
                {activePlayers.map((player) => {
                    const pos = getSeatPosition(player.seat, totalSeats, allSeats);
                    const isDealer = player.isDealer;
                    return (
                        <div
                            key={player.seat}
                            className={styles.seatWrapper}
                            style={{
                                top: pos.top,
                                left: pos.left,
                                transform: "translate(-50%, -50%)"
                            }}
                        >
                            <PlayerCard player={player} isDealer={isDealer} />
                        </div>
                    );
                })}

                {/* Deck seed watermark */}
                {handData?.deck_seed && (
                    <div className={styles.seedWatermark} title={`Deck seed: ${handData.deck_seed}`}>
                        Seed: {handData.deck_seed.slice(0, 12)}...
                    </div>
                )}

            </div>

        </div>
    );
}

// ---- Main Page ----

export default function HandPage() {
    const { gameId } = useParams<{ gameId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();

    const handParam = searchParams.get("hand");
    const blockParam = searchParams.get("block");

    const [hands, setHands] = useState<HandData[]>([]);
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Determine which hand we're viewing
    const selectedHand = useMemo(() => {
        if (!hands.length) return null;
        if (handParam) {
            return hands.find(h => h.hand_number === Number(handParam)) || null;
        }
        if (blockParam) {
            return hands.find(h => h.block_height === Number(blockParam)) || null;
        }
        // Default to latest hand
        return hands[0];
    }, [hands, handParam, blockParam]);

    // Fetch hands from indexer
    const fetchHands = useCallback(async () => {
        if (!gameId) {
            setHandsLoaded(true);
            return;
        }
        try {
            const res = await fetch(`${INDEXER_URL}/api/v1/hands?game_id=${encodeURIComponent(gameId)}`);
            if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
            const data: HandsResponse = await res.json();
            setHands(data.data);
        } catch (err: unknown) {
            console.error("Error fetching hands from indexer:", err);
            // Non-fatal — we can still show the table without hand list
        } finally {
            setHandsLoaded(true);
        }
    }, [gameId]);

    // Fetch historical game state at a specific block height
    const fetchGameState = useCallback(async (blockHeight: number) => {
        if (!gameId) return;
        try {
            setLoading(true);
            setError(null);

            const restEndpoint = currentNetwork.rest;
            const url = `${restEndpoint}/block52/pokerchain/poker/v1/game_state_public/${encodeURIComponent(gameId)}`;

            const res = await fetch(url, {
                headers: { "x-cosmos-block-height": String(blockHeight) }
            });

            if (!res.ok) throw new Error(`Chain returned ${res.status}`);

            const data = await res.json();
            if (!data.game_state) throw new Error("No game_state in response");

            const parsed: TexasHoldemStateDTO = JSON.parse(data.game_state);
            setGameState(parsed);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch game state");
            console.error("Error fetching game state:", err);
        } finally {
            setLoading(false);
        }
    }, [gameId, currentNetwork]);

    // Fetch current game state (fallback when no block height)
    const fetchCurrentGameState = useCallback(async () => {
        if (!gameId) return;
        try {
            setLoading(true);
            setError(null);

            const restEndpoint = currentNetwork.rest;
            const url = `${restEndpoint}/block52/pokerchain/poker/v1/game_state_public/${encodeURIComponent(gameId)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Chain returned ${res.status}`);

            const data = await res.json();
            if (!data.game_state) throw new Error("No game_state in response");

            const parsed: TexasHoldemStateDTO = JSON.parse(data.game_state);
            setGameState(parsed);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch game state");
        } finally {
            setLoading(false);
        }
    }, [gameId, currentNetwork]);

    // Load hands on mount
    useEffect(() => {
        fetchHands();
    }, [fetchHands]);

    // Load game state when selected hand changes
    // Only call fetchCurrentGameState after fetchHands has completed (handsLoaded)
    const [handsLoaded, setHandsLoaded] = useState(false);

    useEffect(() => {
        if (selectedHand) {
            fetchGameState(selectedHand.block_height);
        } else if (handsLoaded && hands.length === 0 && gameId) {
            // Indexer returned no hands — fall back to current state
            fetchCurrentGameState();
        }
    }, [selectedHand, handsLoaded, hands.length, gameId, fetchGameState, fetchCurrentGameState]);

    // Select a hand from the sidebar
    const selectHand = (hand: HandData) => {
        setSearchParams({ hand: String(hand.hand_number) });
    };

    // Page title
    useEffect(() => {
        const shortId = gameId ? gameId.substring(0, 10) : "";
        const handLabel = selectedHand ? ` Hand #${selectedHand.hand_number}` : "";
        document.title = `${shortId}...${handLabel} - Block52 Explorer`;
        return () => { document.title = "Block52 Chain"; };
    }, [gameId, selectedHand]);

    if ((loading || !handsLoaded) && !gameState) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden">
                <AnimatedBackground />
                <div className={`backdrop-blur-md p-8 rounded-xl shadow-2xl text-center relative z-10 ${styles.containerCard}`}>
                    <div className="flex justify-center mb-4">
                        <svg className={`animate-spin h-10 w-10 ${styles.brandText}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Loading hand...</h2>
                </div>
            </div>
        );
    }

    if (!gameState) {
        // Show error or "not found" when we have no game state to render
        return (
            <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden">
                <AnimatedBackground />
                <div className={`backdrop-blur-md p-8 rounded-xl shadow-2xl text-center max-w-lg relative z-10 ${styles.containerCard}`}>
                    <svg className={`h-16 w-16 mx-auto mb-4 ${styles.dangerText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-4">{error || "Hand not found"}</h2>
                    <p className="text-gray-400 text-sm mb-4">Could not load game state for this hand.</p>
                    <button onClick={() => navigate("/explorer")} className={`px-6 py-2 rounded-lg font-bold transition-colors duration-200 ${styles.subtleBrandButton}`}>
                        Back to Explorer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center relative overflow-hidden p-4 md:p-6">
            <AnimatedBackground />
            <div className="w-full max-w-7xl relative z-10">
                {/* Header */}
                <div className="mb-4">
                    <button
                        onClick={() => navigate("/explorer")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${styles.subtleBrandButton}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Explorer
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Main table area */}
                    <div className="flex-1">
                        {/* Game info bar */}
                        <div className={`backdrop-blur-md p-4 rounded-xl shadow-2xl mb-4 ${styles.containerCard}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h1 className="text-xl font-extrabold text-white">Hand Replay</h1>
                                    <p className="text-gray-400 text-xs font-mono mt-1 break-all">{gameId}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedHand && (
                                        <div className="text-right text-sm">
                                            <span className="text-gray-400">Block </span>
                                            <Link
                                                to={`/explorer/block/${selectedHand.block_height}`}
                                                className={`font-mono ${styles.brandText}`}
                                            >
                                                #{selectedHand.block_height}
                                            </Link>
                                            <p className="text-gray-500 text-xs">
                                                {new Date(selectedHand.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                    <a
                                        href={`https://x.com/intent/tweet?text=${encodeURIComponent("Check out this poker hand on Block52!")}&url=${encodeURIComponent(`${window.location.origin}/explorer/hand/${gameId}${selectedHand ? `?hand=${selectedHand.hand_number}` : ""}`)}&hashtags=${encodeURIComponent("Block52,Poker,OnChainPoker")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Share on X"
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Table visualization */}
                        {gameState && (
                            <ReadOnlyTable gameState={gameState} handData={selectedHand || undefined} />
                        )}

                        {/* Previous actions log */}
                        {gameState && gameState.previousActions && gameState.previousActions.length > 0 && (
                            <div className={`backdrop-blur-md p-4 rounded-xl shadow-2xl mt-4 ${styles.containerCard}`}>
                                <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {gameState.previousActions.map((action, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-500 text-xs w-6 text-right">{i + 1}.</span>
                                            <span className="text-gray-400 font-mono text-xs">{truncateAddress(action.playerId)}</span>
                                            <span className={`font-semibold ${styles.brandText}`}>{action.action}</span>
                                            {action.amount && action.amount !== "" && action.amount !== "0" && (
                                                <span className="text-white">{formatStack(action.amount)}</span>
                                            )}
                                            {action.round && (
                                                <span className="text-gray-600 text-xs">({action.round})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Winners */}
                        {gameState && gameState.winners && gameState.winners.length > 0 && (
                            <div className={`backdrop-blur-md p-4 rounded-xl shadow-2xl mt-4 ${styles.containerCard}`}>
                                <h3 className="text-lg font-bold text-white mb-3">Winners</h3>
                                {gameState.winners.map((w, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm mb-2">
                                        <span className="text-gray-400 font-mono text-xs">{truncateAddress(w.address)}</span>
                                        <span className={`font-bold ${styles.successText}`}>{formatPot(w.amount)}</span>
                                        {w.description && <span className="text-gray-400 text-xs">({w.description})</span>}
                                        {w.cards && w.cards.length > 0 && (
                                            <div className="flex gap-1">
                                                {w.cards.map((c, ci) => (
                                                    <img key={ci} src={getCardImageUrl(c)} alt={c} className="w-6 h-9" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar: hand list */}
                    {hands.length > 0 && (
                        <div className="lg:w-64 flex-shrink-0">
                            <div className={`backdrop-blur-md rounded-xl shadow-2xl overflow-hidden ${styles.containerCard}`}>
                                <div className={`px-4 py-3 ${styles.headerCard}`}>
                                    <h3 className="text-sm font-bold text-white">Hands ({hands.length})</h3>
                                </div>
                                <div className="max-h-[600px] overflow-y-auto">
                                    {hands.map((hand) => {
                                        const isSelected = selectedHand?.hand_number === hand.hand_number;
                                        return (
                                            <button
                                                key={hand.hand_number}
                                                onClick={() => selectHand(hand)}
                                                className={`w-full text-left px-4 py-3 border-b border-gray-700/30 transition-colors duration-150 ${
                                                    isSelected ? styles.handListSelected : styles.handListItem
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-bold text-sm ${isSelected ? "text-white" : "text-gray-300"}`}>
                                                        Hand #{hand.hand_number}
                                                    </span>
                                                    <span className="text-gray-500 text-xs">
                                                        #{hand.block_height}
                                                    </span>
                                                </div>
                                                <div className="text-gray-500 text-xs mt-1">
                                                    {new Date(hand.created_at).toLocaleTimeString()}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
