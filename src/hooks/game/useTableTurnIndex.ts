import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { TableTurnIndexReturn } from "../../types/index";
import { isEmpty } from "@block52/ui-sdk/helpers";

/**
 * Custom hook to get the next turn index for actions at a table
 * @param tableId The table ID (not used - Context manages subscription)
 * @returns Object containing the next turn index and loading/error states
 */
export function useTableTurnIndex(): TableTurnIndexReturn {
  // Get game state directly from Context - no additional WebSocket connections
  const { gameState, isLoading, error } = useGameStateContext();

  // Memoize the next turn index calculation
  const nextTurnIndex = useMemo((): number => {
    if (!gameState) {
      return 0; // Default to 0 if there's no data
    }

    try {
      // Get the previousActions array
      const previousActions = gameState.previousActions || [];
      
      if (isEmpty(previousActions)) {
        return 0; // If no previous actions, start with index 0
      }
      
      // Sort actions by index to ensure we get the highest one
      // This is in case they're not already sorted
      const sortedActions = [...previousActions].sort((a, b) => a.index - b.index);
      
      // Get the latest action (highest index)
      const latestAction = sortedActions[sortedActions.length - 1];
      
      // The next index is the latest index + 1
      return latestAction.index + 1;
    } catch (err) {
      console.error("Error calculating next turn index:", err);
      return 0; // Default to 0 if there's an error
    }
  }, [gameState]);

  return {
    nextTurnIndex,
    isLoading,
    error
  };
} 