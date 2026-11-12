import { useState, useEffect, useMemo, useRef } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useShowingCardsByAddress } from "./useShowingCardsByAddress";
import { hasValue, isNullish } from "../../utils/guards";
import {
    PokerSolver,
    Deck,
    GameVariant,
    holeCardsPerPlayer
} from "@block52/poker-vm-sdk";
import { equityHands, exactShowdownWinPercentages, shouldShowAllInEquity } from "../../utils/allInEquity";

/**
 * Monte Carlo iterations per simulation. Each iteration copies and shuffles the
 * remaining deck and evaluates every live hand, so this number multiplies
 * directly into main-thread time.
 */
const EQUITY_ITERATIONS = 5000;

/**
 * Omaha scores 60 two-plus-three candidates per hand where Hold'em scores 21,
 * so it runs fewer iterations to keep the main-thread cost about the same
 * (ui#769). 2000 still puts the estimate within a couple of points.
 */
const OMAHA_EQUITY_ITERATIONS = 2000;

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
        if (isNullish(oldest)) {
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
 * Fires in three scenarios:
 *   A) All-in (issue #32): every contesting player is ALL_IN or SHOWING, cards face up.
 *   B) Showdown reveal (issue #313): round is SHOWDOWN/END and 2+ hands are face up.
 *   C) Runout (ui#210): betting is closed (nextToAct is not a seat) and every
 *      contesting hand is face up — including an ACTIVE last caller and
 *      BUSTED losers with cardsShown. Folded players are excluded.
 * A finished board shows 100% for the winner, or an equal split on a chop.
 */
export function useAllInEquity(): AllInEquityResult {
    const { gameState, gameVariant } = useGameStateContext();
    const { showingBySeat } = useShowingCardsByAddress();

    const [equities, setEquities] = useState<Map<number, number>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Track last calculated state to avoid duplicate calls
    const lastCalculationRef = useRef<string>("");

    // Two for Hold'em, four for Omaha (ui#769).
    const holeCount = holeCardsPerPlayer(gameVariant);

    /**
     * Face-up hands still in the pot. Folded seats are left out, and a
     * tournament loser counts only while cardsShown tables the hand.
     */
    const playersWithVisibleCards = useMemo(() => {
        if (!gameState?.players) return [];
        return equityHands(gameState.players, holeCount, showingBySeat);
    }, [gameState?.players, holeCount, showingBySeat]);

    const shouldShow = useMemo(() => {
        if (!gameState?.players) return false;
        return shouldShowAllInEquity({
            players: gameState.players,
            round: gameState.round,
            nextToAct: gameState.nextToAct,
            holeCount,
            shownBySeat: showingBySeat
        });
    }, [gameState?.players, gameState?.round, gameState?.nextToAct, holeCount, showingBySeat]);

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
            variant: gameVariant ?? "",
            hands: playersWithVisibleCards.map(p => p.cards),
            board: communityCards
        });
    }, [shouldShow, playersWithVisibleCards, communityCards, gameVariant]);

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
            const settled = exactShowdownWinPercentages(
                playersWithVisibleCards.map(p => p.cards),
                communityCards,
                gameVariant
            );
            let winPercentages: number[];
            if (settled) {
                winPercentages = settled;
            } else {
                const handsAsCards = playersWithVisibleCards.map(p =>
                    p.cards.map(c => Deck.fromString(c))
                );
                const boardAsCards = communityCards.map(c => Deck.fromString(c));
                const isOmaha = gameVariant === GameVariant.OMAHA;
                winPercentages = PokerSolver.calculateMultiPlayerEquity(
                    handsAsCards,
                    boardAsCards,
                    isOmaha ? OMAHA_EQUITY_ITERATIONS : EQUITY_ITERATIONS,
                    gameVariant
                ).winPercentages;
            }

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
