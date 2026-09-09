import { useState, useEffect, useMemo, useRef } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useShowingCardsByAddress } from "./useShowingCardsByAddress";
import { hasValue } from "../../utils/guards";
import {
    PlayerStatus,
    PlayerDTO,
    TexasHoldemRound,
    PokerSolver,
    Deck
} from "@block52/poker-vm-sdk";

/**
 * Monte Carlo iterations per simulation. Each iteration copies and shuffles the
 * remaining deck and evaluates every live hand, so this number multiplies
 * directly into main-thread time.
 */
const EQUITY_ITERATIONS = 5000;

/**
 * How many distinct (hands, board) results to retain across all hook instances.
 * A hand's board only moves forward — preflop, flop, turn, river — and is never
 * revisited, so a handful of entries is enough to deduplicate the simultaneous
 * per-seat calls without growing over a session.
 */
const EQUITY_CACHE_LIMIT = 4;

/**
 * Simulation results shared across every hook instance, keyed by the full input.
 *
 * This hook is mounted once per SEAT (Player + OppositePlayer), but the
 * simulation it runs is GLOBAL — the same hands and the same board produce the
 * same answer for every seat. Without sharing, a 9-seat table runs nine
 * independent 5000-iteration simulations (~210k five-card evaluations each,
 * synchronously on the main thread) to arrive at one identical result.
 *
 * Runout frame expansion makes sharing essential rather than merely nice: the
 * board now advances in three separate commits (flop, turn, river) instead of
 * one, so an unshared cache would mean 27 full simulations per all-in hand.
 *
 * Cached Maps are handed out by reference and MUST be treated as immutable.
 */
const equityCache = new Map<string, Map<number, number>>();

/**
 * Clear the shared cache. Exported for tests only — it is module-level state,
 * so without this a cached result leaks from one test case into the next.
 */
export function resetEquityCache(): void {
    equityCache.clear();
}

function writeEquityCache(key: string, equities: Map<number, number>): void {
    equityCache.set(key, equities);
    // Map iterates in insertion order, so the first key is the oldest.
    while (equityCache.size > EQUITY_CACHE_LIMIT) {
        const oldest = equityCache.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        equityCache.delete(oldest);
    }
}

/**
 * Return type for useAllInEquity hook
 */
interface AllInEquityResult {
    /** Map of seat index to equity percentage (0-100) */
    equities: Map<number, number>;
    /** Whether equity should be shown (all players all-in with visible cards) */
    shouldShow: boolean;
    /** Whether equity calculation is in progress */
    isLoading: boolean;
    /** Error if equity calculation failed */
    error: Error | null;
}

/**
 * Hook to calculate and display equity.
 *
 * Calculated client-side via SDK PokerSolver (Monte Carlo) — no HTTP call.
 *
 * Fires in two scenarios:
 *   A) All-in (issue #32): every active player is ALL_IN and all have visible cards.
 *   B) Showdown reveal (issue #313): round is SHOWDOWN/END and 2+ players have visible cards.
 */
export function useAllInEquity(): AllInEquityResult {
    const { gameState } = useGameStateContext();
    const { showingPlayers } = useShowingCardsByAddress();

    const [equities, setEquities] = useState<Map<number, number>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Track last calculated state to avoid duplicate calls
    const lastCalculationRef = useRef<string>("");

    /**
     * Get active (non-folded) players
     */
    const activePlayers = useMemo(() => {
        if (!gameState?.players) return [];
        return gameState.players.filter(
            (p: PlayerDTO) => p.status !== PlayerStatus.FOLDED
        );
    }, [gameState?.players]);

    /**
     * Check if all active players are effectively all-in.
     * An all-in player whose cards have been revealed transitions to SHOWING, so
     * we treat SHOWING as equivalent for gating purposes.
     */
    const allPlayersAllIn = useMemo(() => {
        if (activePlayers.length < 2) return false;
        return activePlayers.every(
            (p: PlayerDTO) =>
                p.status === PlayerStatus.ALL_IN ||
                p.status === PlayerStatus.SHOWING
        );
    }, [activePlayers]);

    /**
     * Seat index of showingPlayers so the visible-cards loop below is O(1)
     * per player instead of re-scanning showingPlayers per seat (#2455).
     */
    const showingPlayerBySeat = useMemo(() => {
        const bySeat = new Map<number, { seat: number; holeCards?: string[] }>();
        if (showingPlayers) {
            for (const sp of showingPlayers) bySeat.set(sp.seat, sp);
        }
        return bySeat;
    }, [showingPlayers]);

    /**
     * Get players with visible cards (from showingPlayers or game state)
     */
    const playersWithVisibleCards = useMemo(() => {
        if (!gameState?.players) return [];

        const visible: Array<{ seat: number; cards: string[] }> = [];

        for (const player of activePlayers) {
            // Check if player is showing cards
            const showingPlayer = showingPlayerBySeat.get(player.seat);
            if (showingPlayer?.holeCards && showingPlayer.holeCards.length === 2) {
                visible.push({ seat: player.seat, cards: showingPlayer.holeCards });
                continue;
            }

            // Check if player's hole cards are visible in game state
            if (player.holeCards && player.holeCards.length === 2) {
                // Only count if cards are actual cards, not hidden/masked
                const hasRealCards = player.holeCards.every(
                    (c: string) => c && c !== "??" && c !== "XX" && c.length >= 2
                );
                if (hasRealCards) {
                    visible.push({ seat: player.seat, cards: player.holeCards });
                }
            }
        }

        return visible;
    }, [activePlayers, showingPlayerBySeat, gameState?.players]);

    /**
     * Seats that have visible cards — membership test for the all-in gate
     * below, O(1) instead of a per-player .some() scan (#2455).
     */
    const visibleSeats = useMemo(() => {
        return new Set(playersWithVisibleCards.map(v => v.seat));
    }, [playersWithVisibleCards]);

    /**
     * Round is at showdown / end.
     */
    const isShowdown = useMemo(() => {
        return gameState?.round === TexasHoldemRound.SHOWDOWN ||
               gameState?.round === TexasHoldemRound.END;
    }, [gameState?.round]);

    const shouldShow = useMemo(() => {
        if (playersWithVisibleCards.length < 2) return false;

        // Scenario A: all active players all-in with all hole cards visible.
        if (allPlayersAllIn && activePlayers.length >= 2) {
            const allHaveVisibleCards = activePlayers.every(
                (p: PlayerDTO) => visibleSeats.has(p.seat)
            );
            if (allHaveVisibleCards) return true;
        }

        // Scenario B: showdown with 2+ revealed hands.
        if (isShowdown) return true;

        return false;
    }, [allPlayersAllIn, activePlayers, visibleSeats, isShowdown, playersWithVisibleCards.length]);

    /**
     * Get community cards from game state
     */
    const communityCards = useMemo(() => {
        if (!gameState?.communityCards) return [];
        return gameState.communityCards.filter(
            (c: string) => c && c !== "??" && c !== "XX"
        );
    }, [gameState?.communityCards]);

    /**
     * The complete input to the simulation, as a stable string.
     *
     * This is both the cache key and the effect's trigger. It has to be a value,
     * not an array identity: `playersWithVisibleCards` and `communityCards` are
     * rebuilt from a fresh `gameState` on every WS frame, so depending on them
     * re-armed the 300ms debounce several times a second, in all nine instances,
     * for the entire duration of a showdown.
     */
    const equityKey = useMemo(() => {
        if (!shouldShow || playersWithVisibleCards.length < 2) {
            return "";
        }
        return JSON.stringify({
            hands: playersWithVisibleCards.map(p => p.cards),
            board: communityCards
        });
    }, [shouldShow, playersWithVisibleCards, communityCards]);

    /**
     * Calculate equity client-side via SDK Monte Carlo.
     */
    const calculateEquity = () => {
        if (!shouldShow || playersWithVisibleCards.length < 2) {
            setEquities(new Map());
            return;
        }

        if (equityKey === lastCalculationRef.current) {
            return;
        }

        // Another seat's instance may already have run this exact simulation.
        const shared = equityCache.get(equityKey);
        if (shared) {
            setEquities(shared);
            lastCalculationRef.current = equityKey;
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const handsAsCards = playersWithVisibleCards.map(p =>
                p.cards.map(c => Deck.fromString(c))
            );
            const boardAsCards = communityCards.map(c => Deck.fromString(c));

            const { winPercentages } = PokerSolver.calculateMultiPlayerEquity(
                handsAsCards,
                boardAsCards,
                EQUITY_ITERATIONS
            );

            const newEquities = new Map<number, number>();
            winPercentages.forEach((pct, idx) => {
                const seat = playersWithVisibleCards[idx]?.seat;
                if (hasValue(seat)) {
                    newEquities.set(seat, pct);
                }
            });

            writeEquityCache(equityKey, newEquities);
            setEquities(newEquities);
            lastCalculationRef.current = equityKey;
        } catch (err) {
            console.error("Equity calculation error:", err);
            setError(err as Error);
            setEquities(new Map());
        } finally {
            setIsLoading(false);
        }
    };

    // Held in a ref so the debounce effect below can depend on the INPUT rather
    // than on this function's identity, which changes every render.
    const calculateEquityRef = useRef(calculateEquity);
    useEffect(() => {
        calculateEquityRef.current = calculateEquity;
    });

    /**
     * Recalculate equity when the inputs actually change.
     */
    useEffect(() => {
        if (shouldShow) {
            // Debounce the calculation slightly to avoid rapid re-calls
            const timeout = setTimeout(() => {
                calculateEquityRef.current();
            }, 300);
            return () => clearTimeout(timeout);
        } else {
            // Clear equities when conditions are not met
            setEquities(new Map());
            lastCalculationRef.current = "";
        }
    }, [shouldShow, equityKey]);

    return {
        equities,
        shouldShow,
        isLoading,
        error
    };
}

export default useAllInEquity;
