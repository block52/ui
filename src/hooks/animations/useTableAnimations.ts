import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { TableAnimationsReturn } from "@block52/poker-ui-core/types";

/**
 * Custom hook to provide table animation-related information
 * @param tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing table animation properties such as tableSize
 */
export const useTableAnimations = (): TableAnimationsReturn => {
  // Get game state directly from Context - no additional WebSocket connections
  const { gameState, isLoading, error } = useGameStateContext();

  // Memoize the table size calculation
  const tableSize = useMemo((): number => {
    const defaultTableSize = 9;
    
    if (!gameState?.gameOptions) {
      return defaultTableSize;
    }

    try {
      // Extract table size (maximum players) from game options
      return gameState.gameOptions.maxPlayers;
    } catch (err) {
      console.error("Error parsing table size from game options:", err);
      return defaultTableSize;
    }
  }, [gameState]);

  return {
    tableSize,
    isLoading,
    error
  };
}; 