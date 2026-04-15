import { useMemo } from "react";
import { ActionDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerChipDataReturn } from "../../types/index";
import { useGameStateContext } from "../../context/GameStateContext";
import { shouldShowChips, getRelevantChipAmounts, calculateCurrentRoundBetting } from "../../utils/chipUtils";

/**
 * Custom hook to fetch and provide player chip data for each seat.
 *
 * Returns two accessors:
 *  - getChipAmount(seat)  → single total string (backwards-compatible)
 *  - getChipActions(seat) → string[] of per-action USDC micro-unit amounts,
 *    one entry per betting action the player made in the current round.
 *    Oldest actions are merged when count exceeds MAX_ACTION_GROUPS.
 */
export const usePlayerChipData = (): PlayerChipDataReturn => {
    const { gameState, isLoading, error } = useGameStateContext();

    const playerChipAmounts = useMemo(() => {
        const amounts: Record<number, string> = {};

        if (!gameState || !gameState.players || !Array.isArray(gameState.players)) {
            return amounts;
        }

        const currentRound = gameState.round;

        gameState.players.forEach(player => {
            if (!player.seat || !player.address) return;

            if (!shouldShowChips(player.status)) {
                amounts[player.seat] = "0";
                return;
            }

            let chipAmount = "0";

            if (currentRound === TexasHoldemRound.ANTE || currentRound === TexasHoldemRound.PREFLOP) {
                chipAmount = player.sumOfBets || "0";
            } else {
                chipAmount = calculateCurrentRoundBetting(player.address, currentRound, gameState.previousActions || []);
            }

            amounts[player.seat] = chipAmount;
        });

        return amounts;
    }, [gameState]);

    // Per-action chip amounts (one entry per betting action in the current display window)
    const playerChipActions = useMemo(() => {
        const actions: Record<number, string[]> = {};

        if (!gameState || !gameState.players || !Array.isArray(gameState.players)) {
            return actions;
        }

        const currentRound = gameState.round;
        const previousActions: ActionDTO[] = gameState.previousActions || [];

        gameState.players.forEach(player => {
            if (!player.seat || !player.address) return;

            if (!shouldShowChips(player.status)) {
                actions[player.seat] = [];
                return;
            }

            const amounts = getRelevantChipAmounts(player.address, currentRound, previousActions);

            if (amounts.length > 0) {
                actions[player.seat] = amounts;
            } else {
                // Fallback: if no previousActions matched but sumOfBets exists,
                // show as a single group (covers edge cases)
                const total = playerChipAmounts[player.seat];
                actions[player.seat] = total && total !== "0" ? [total] : [];
            }
        });

        return actions;
    }, [gameState, playerChipAmounts]);

    const getChipAmount = (_seatIndex: number): string => {
        return playerChipAmounts[_seatIndex] || "0";
    };

    const getChipActions = (_seatIndex: number): string[] => {
        return playerChipActions[_seatIndex] || [];
    };

    const defaultState: PlayerChipDataReturn = {
        getChipAmount: (_seatIndex: number): string => "0",
        getChipActions: (_seatIndex: number): string[] => [],
        isLoading,
        error
    };

    if (isLoading || error) {
        return defaultState;
    }

    return {
        getChipAmount,
        getChipActions,
        isLoading: false,
        error: null
    };
};
