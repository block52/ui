import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useShowingCardsByAddress } from "./useShowingCardsByAddress";
import {
    PlayerStatus,
    PlayerDTO,
    TexasHoldemRound,
    PokerSolver,
    Deck
} from "@block52/poker-vm-sdk";

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
     * Get players with visible cards (from showingPlayers or game state)
     */
    const playersWithVisibleCards = useMemo(() => {
        if (!gameState?.players) return [];

        const visible: Array<{ seat: number; cards: string[] }> = [];

        for (const player of activePlayers) {
            // Check if player is showing cards
            const showingPlayer = showingPlayers?.find((sp: { seat: number; holeCards?: string[] }) => sp.seat === player.seat);
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
    }, [activePlayers, showingPlayers, gameState?.players]);

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
                (p: PlayerDTO) => playersWithVisibleCards.some(v => v.seat === p.seat)
            );
            if (allHaveVisibleCards) return true;
        }

        // Scenario B: showdown with 2+ revealed hands.
        if (isShowdown) return true;

        return false;
    }, [allPlayersAllIn, activePlayers, playersWithVisibleCards, isShowdown]);

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
     * Calculate equity client-side via SDK Monte Carlo.
     */
    const calculateEquity = useCallback(() => {
        if (!shouldShow || playersWithVisibleCards.length < 2) {
            setEquities(new Map());
            return;
        }

        const cacheKey = JSON.stringify({
            hands: playersWithVisibleCards.map(p => p.cards),
            board: communityCards
        });

        if (cacheKey === lastCalculationRef.current) {
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
                5000
            );

            const newEquities = new Map<number, number>();
            winPercentages.forEach((pct, idx) => {
                const seat = playersWithVisibleCards[idx]?.seat;
                if (seat !== undefined) {
                    newEquities.set(seat, pct);
                }
            });

            setEquities(newEquities);
            lastCalculationRef.current = cacheKey;
        } catch (err) {
            console.error("Equity calculation error:", err);
            setError(err as Error);
            setEquities(new Map());
        } finally {
            setIsLoading(false);
        }
    }, [shouldShow, playersWithVisibleCards, communityCards]);

    /**
     * Recalculate equity when conditions change
     */
    useEffect(() => {
        if (shouldShow) {
            // Debounce the calculation slightly to avoid rapid re-calls
            const timeout = setTimeout(() => {
                calculateEquity();
            }, 300);
            return () => clearTimeout(timeout);
        } else {
            // Clear equities when conditions are not met
            setEquities(new Map());
            lastCalculationRef.current = "";
        }
    }, [shouldShow, calculateEquity]);

    return {
        equities,
        shouldShow,
        isLoading,
        error
    };
}

export default useAllInEquity;
