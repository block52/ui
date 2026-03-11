import { useMemo } from "react";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerChipDataReturn } from "../../types/index";
import { useGameStateContext } from "../../context/GameStateContext";

/**
 * Custom hook to fetch and provide player chip data for each seat
 * FIXED: Only shows chips for players in active gameplay (not SEATED, SITTING_OUT, etc.)
 * Shows current round betting only, not accumulated totals
 */
export const usePlayerChipData = (): PlayerChipDataReturn => {
    const { gameState, isLoading, error } = useGameStateContext();

    // Calculate current round betting amounts
    const playerChipAmounts = useMemo(() => {
        const amounts: Record<number, string> = {};

        if (!gameState || !gameState.players || !Array.isArray(gameState.players)) {
            return amounts;
        }

        // Get current round from game state
        const currentRound = gameState.round;

        gameState.players.forEach(player => {
            if (!player.seat || !player.address) return;

            // ONLY show chips for players who are actively playing
            // Don't show chips for SEATED (just joined, game not started),
            // SITTING_OUT, BUSTED, WAITING, SITTING_IN, or SHOWING players
            const shouldShowChips = (
                player.status === PlayerStatus.ACTIVE ||
                player.status === PlayerStatus.ALL_IN ||
                player.status === PlayerStatus.FOLDED
            );

            if (!shouldShowChips) {
                amounts[player.seat] = "0";
                return;
            }

            // FIXED: Only show chips based on current round logic
            let chipAmount = "0";

            if (currentRound === TexasHoldemRound.ANTE || currentRound === TexasHoldemRound.PREFLOP) {
                // During ante/preflop, show accumulated bets (includes blinds)
                chipAmount = player.sumOfBets || "0";
            } else {
                // After preflop, calculate current round betting only
                chipAmount = calculateCurrentRoundBetting(player, currentRound, gameState.previousActions || []);
            }

            amounts[player.seat] = chipAmount;
        });

        return amounts;
    }, [gameState]);

    const getChipAmount = (_seatIndex: number): string => {
        return playerChipAmounts[_seatIndex] || "0";
    };

    const defaultState: PlayerChipDataReturn = {
        getChipAmount: (_seatIndex: number): string => "0",
        isLoading,
        error
    };

    if (isLoading || error) {
        return defaultState;
    }

    return {
        getChipAmount,
        isLoading: false,
        error: null
    };
};

/**
 * Calculate how much a player has bet in the current round only
 */
function calculateCurrentRoundBetting(
    player: { address: string },
    currentRound: string,
    previousActions: Array<{ playerId: string; round: string; amount?: string }>
): string {
    // Find all actions by this player in the current round
    const currentRoundActions = previousActions.filter(action =>
        action.playerId === player.address &&
        action.round === currentRound &&
        action.amount &&
        action.amount !== "0" &&
        action.amount !== ""
    );

    // Sum up all betting actions in current round
    const totalCurrentRoundBetting = currentRoundActions.reduce((sum, action) => {
        const amount = BigInt(action.amount || "0");
        return sum + amount;
    }, BigInt(0));

    return totalCurrentRoundBetting.toString();
}