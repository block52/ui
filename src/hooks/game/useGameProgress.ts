import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { GameProgressReturn } from "../../types/index";
import { PlayerDTO, PlayerStatus } from "@block52/poker-vm-sdk";

/**
 * Custom hook to check if a game is in progress and provide game status information
 * @param tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing:
 * - isGameInProgress: boolean indicating if a game is currently being played
 * - activePlayers: array of players who are not folded or sitting out
 * - playerCount: number of active players
 * - handNumber: current hand number in the game session
 * - actionCount: current action count in the hand
 * - nextToAct: seat number of the next player to act
 * - previousActions: array of previous actions in the current hand
 * - isLoading: boolean indicating if data is being loaded
 * - error: any error that occurred during data fetching
 */
export const useGameProgress = (_tableId?: string): GameProgressReturn => {
    // Get game state directly from Context - no additional WebSocket connections
    const { gameState, isLoading, error } = useGameStateContext();

    // Memoized on the snapshot rather than recomputed per render. The players
    // filter and both object literals used to run on EVERY render of every
    // consumer, and plenty of renders are not driven by a new snapshot at all --
    // the blind-level tick alone re-renders the whole Table tree once a second.
    //
    // Keyed on `gameState` itself (a fresh object per WS frame) rather than on a
    // content fingerprint, because the result holds REFERENCES into it:
    // `activePlayers` and `previousActions` are the snapshot's own objects, so a
    // fingerprint that ignored, say, stack changes would hand back stale
    // PlayerDTOs.
    return useMemo<GameProgressReturn>(() => {
        // Default values in case of error or loading
        const defaultState: GameProgressReturn = {
            isGameInProgress: false,
            activePlayers: [],
            playerCount: 0,
            handNumber: 0,
            actionCount: 0,
            nextToAct: 0,
            previousActions: [],
            isLoading,
            error
        };

        // If still loading or error occurred, return default values
        if (isLoading || error || !gameState) {
            return defaultState;
        }

        try {
            if (!gameState.players) {
                return defaultState;
            }

            // Filter for active players (not folded, not sitting out, and not seated)
            const activePlayers = gameState.players.filter(
                (player: PlayerDTO) =>
                    player.status !== PlayerStatus.FOLDED && player.status !== PlayerStatus.SITTING_OUT && player.status !== PlayerStatus.SEATED
            );

            // Game is in progress if there are at least 2 active players
            const isGameInProgress = activePlayers.length > 1;

            return {
                isGameInProgress,
                activePlayers,
                playerCount: activePlayers.length,
                handNumber: gameState.handNumber || 0,
                actionCount: gameState.previousActions?.length || 0,
                nextToAct: gameState.nextToAct || 0,
                previousActions: gameState.previousActions || [],
                isLoading: false,
                error: null
            };
        } catch (err) {
            console.error("Error checking game progress:", err);
            return {
                ...defaultState,
                error: err instanceof Error ? err : new Error(String(err))
            };
        }
    }, [gameState, isLoading, error]);
};
