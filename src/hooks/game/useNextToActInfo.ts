import { useMemo } from "react";
import { PlayerDTO, LegalActionDTO } from "@block52/poker-vm-sdk";
import { NextToActInfoReturn } from "../../types/index";
import { useGameStateContext } from "../../context/GameStateContext";
import { getTimeoutMs, timeoutToSeconds } from "../../utils/timerUtils";

/**
 * Custom hook to fetch and provide information about who is next to act
 * 
 * SIMPLIFIED: Uses GameStateContext directly instead of useGameState
 * This prevents creating multiple WebSocket connections for the same table
 * 
 * @param tableId The ID of the table to fetch state for (not used - Context manages subscription)
 * @returns Object containing next-to-act information
 */
export const useNextToActInfo = (_tableId?: string): NextToActInfoReturn => {
    // Get game state directly from Context - no additional WebSocket connections
    const { gameState, isLoading, error } = useGameStateContext();

    // Calculate next-to-act information
    const result = useMemo(() => {
        // Create default values inside useMemo to avoid dependency issues
        const defaultValues: NextToActInfoReturn = {
            seat: null,
            player: null,
            isCurrentUserTurn: false,
            availableActions: [],
            timeRemaining: 0,
            isLoading,
            error
        };

        try {
            if (!gameState || !gameState.players || !Array.isArray(gameState.players) || gameState.players.length === 0) {
                return defaultValues;
            }

            const nextToActSeat = gameState.nextToAct;
            if (nextToActSeat === undefined || nextToActSeat === null) {
                return defaultValues;
            }

            // Find the player who is next to act
            const player = gameState.players.find((p: PlayerDTO) => p && p.seat === nextToActSeat);
            if (!player) {
                return defaultValues;
            }

            // Check if it's the current user's turn
            const userAddress = localStorage.getItem("user_cosmos_address")?.toLowerCase();
            const isCurrentUserTurn = player.address?.toLowerCase() === userAddress;

            // Get available actions - ensure it's an array
            const availableActions: LegalActionDTO[] = Array.isArray(player.legalActions) ? player.legalActions : [];

            // Use shared util for consistent timeout handling
            const timeRemaining = timeoutToSeconds(getTimeoutMs(player.timeout));

            return {
                seat: nextToActSeat,
                player,
                isCurrentUserTurn,
                availableActions,
                timeRemaining,
                isLoading: false,
                error: null
            };
        } catch (err) {
            console.error("Error parsing next-to-act info:", err);
            return {
                ...defaultValues,
                error: err instanceof Error ? err : new Error("Error parsing next-to-act info")
            };
        }
    }, [gameState, isLoading, error]);

    return result;
};
