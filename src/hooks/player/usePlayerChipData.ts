import { useMemo } from "react";
import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerChipDataReturn } from "../../types/index";
import { useGameStateContext } from "../../context/GameStateContext";
import { MAX_ACTION_GROUPS } from "../../constants/chips";
import { shouldShowChips } from "../../utils/chipUtils";

/** Action types that place chips on the table */
const CHIP_ACTIONS: string[] = [
    PlayerActionType.SMALL_BLIND,
    PlayerActionType.BIG_BLIND,
    PlayerActionType.BET,
    PlayerActionType.CALL,
    PlayerActionType.RAISE,
    PlayerActionType.ALL_IN,
];

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
                chipAmount = calculateCurrentRoundBetting(player, currentRound, gameState.previousActions || []);
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

            // Determine which actions to show as chip groups
            let relevantActions: ActionDTO[];

            if (currentRound === TexasHoldemRound.ANTE || currentRound === TexasHoldemRound.PREFLOP) {
                // During preflop, include blinds + any preflop actions
                relevantActions = previousActions.filter(a =>
                    a.playerId === player.address &&
                    (a.round === TexasHoldemRound.ANTE || a.round === TexasHoldemRound.PREFLOP) &&
                    CHIP_ACTIONS.includes(a.action) &&
                    a.amount && a.amount !== "0"
                );
            } else {
                // Post-flop: only current round actions
                relevantActions = previousActions.filter(a =>
                    a.playerId === player.address &&
                    a.round === currentRound &&
                    CHIP_ACTIONS.includes(a.action) &&
                    a.amount && a.amount !== "0"
                );
            }

            // Sort by index (chronological order)
            relevantActions.sort((a, b) => a.index - b.index);

            // Extract amounts
            const amounts = relevantActions.map(a => a.amount);

            // Cap to MAX_ACTION_GROUPS by merging oldest actions into one group
            if (amounts.length > MAX_ACTION_GROUPS) {
                const mergeCount = amounts.length - MAX_ACTION_GROUPS + 1;
                const mergedTotal = amounts.slice(0, mergeCount).reduce(
                    (sum, val) => sum + BigInt(val), BigInt(0)
                );
                actions[player.seat] = [mergedTotal.toString(), ...amounts.slice(mergeCount)];
            } else if (amounts.length > 0) {
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

/**
 * Calculate how much a player has bet in the current round only
 */
function calculateCurrentRoundBetting(
    player: { address: string },
    currentRound: string,
    previousActions: Array<{ playerId: string; round: string; amount?: string }>
): string {
    const currentRoundActions = previousActions.filter(action =>
        action.playerId === player.address &&
        action.round === currentRound &&
        action.amount &&
        action.amount !== "0" &&
        action.amount !== ""
    );

    const totalCurrentRoundBetting = currentRoundActions.reduce((sum, action) => {
        const amount = BigInt(action.amount || "0");
        return sum + amount;
    }, BigInt(0));

    return totalCurrentRoundBetting.toString();
}