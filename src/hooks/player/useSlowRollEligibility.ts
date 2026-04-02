import { useMemo } from "react";
import { PlayerActionType, TexasHoldemRound, ActionDTO } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { useWinnerInfo } from "../game/useWinnerInfo";

/**
 * Hook to determine if the current player is eligible for a "slow roll"
 *
 * Slow roll eligibility requires:
 * 1. Player is at showdown
 * 2. Player has the SHOW action available (meaning they're in the showdown)
 * 3. Player is a winner
 * 4. Player's last action in the final betting round was a CALL (not a bet/raise)
 *
 * @returns Whether the player can slow roll
 */
export const useSlowRollEligibility = (): boolean => {
    const { gameState } = useGameStateContext();
    const { winnerInfo } = useWinnerInfo();

    const userAddress = useMemo(
        () => localStorage.getItem("user_cosmos_address")?.toLowerCase(),
        []
    );

    const isEligible = useMemo(() => {
        // Must have game state and be at showdown
        if (!gameState || gameState.round !== TexasHoldemRound.SHOWDOWN) {
            return false;
        }

        // Must have user address
        if (!userAddress) {
            return false;
        }

        // Must be a winner
        const isWinner = winnerInfo?.some(
            (winner) => winner.address?.toLowerCase() === userAddress
        );

        if (!isWinner) {
            return false;
        }

        // Check if player's last betting action was a CALL
        const previousActions = gameState.previousActions || [];

        // Get the user's actions
        const userActions = previousActions.filter(
            (action: ActionDTO) => action.playerId?.toLowerCase() === userAddress
        );

        if (userActions.length === 0) {
            return false;
        }

        // Find the last betting action (excluding show/muck)
        const bettingActionTypes = [
            PlayerActionType.BET,
            PlayerActionType.RAISE,
            PlayerActionType.CALL,
            PlayerActionType.CHECK,
            PlayerActionType.ALL_IN
        ];

        const userBettingActions = userActions.filter((action: ActionDTO) =>
            bettingActionTypes.includes(action.action as PlayerActionType)
        );

        if (userBettingActions.length === 0) {
            return false;
        }

        // Get the last betting action
        const lastBettingAction = userBettingActions[userBettingActions.length - 1];

        // Slow roll is only available if the last action was a CALL
        // (meaning they didn't put in the final aggression)
        return lastBettingAction.action === PlayerActionType.CALL;
    }, [gameState, userAddress, winnerInfo]);

    return isEligible;
};
