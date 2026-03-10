import React from "react";
import { PlayerStatus, PlayerDTO } from "@block52/poker-vm-sdk";
import { PlayerDataReturn } from "../../types/index";
import { useGameStateContext } from "../../context/GameStateContext";
import { convertUSDCToNumber } from "../../utils/numberUtils";
import { isTournamentFormat } from "../../utils/gameFormatUtils";

/**
 * Custom hook to fetch player data for a specific seat
 * 
 * NOTE: Player data is handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress 
 * and playerId parameters. This hook reads the real-time player data from that context.
 * 
 * @param seatIndex The seat index to get player data for
 * @returns Object with player data and utility functions
 */
export const usePlayerData = (seatIndex?: number): PlayerDataReturn => {
  // Get game state directly from Context - real-time data via WebSocket
  const { gameState, gameFormat, error, isLoading } = useGameStateContext();

  // Get player data from the table state
  const playerData = React.useMemo((): PlayerDTO | null => {
    if (!gameState || !seatIndex) {
      return null;
    }

    if (!gameState.players) {
      return null;
    }

    const player = gameState.players.find((p: PlayerDTO) => p.seat === seatIndex);

    return player || null;
  }, [gameState, seatIndex]);
  
  // Check if this is a tournament-style game (sit-and-go or tournament)
  const isTournament = React.useMemo((): boolean => {
    return isTournamentFormat(gameFormat);
  }, [gameFormat]);

  // Format stack value
  // - Tournament games: stack is already in chip units (e.g., 1500 chips)
  // - Cash games: stack is in USDC microunits (6 decimals), needs conversion
  const stackValue = React.useMemo((): number => {
    if (!playerData?.stack) {
      return 0;
    }

    const rawStack = Number(playerData.stack);

    if (isTournament) {
      // Tournament chips are stored as whole numbers, use directly
      return rawStack;
    } else {
      // Cash game stacks are in USDC microunits, need conversion
      const converted = convertUSDCToNumber(playerData.stack);
      return converted;
    }
  }, [playerData?.stack, isTournament]);
  
  // Calculate derived properties
  const isFolded = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.FOLDED;
  }, [playerData]);
  
  const isAllIn = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.ALL_IN;
  }, [playerData]);

  const isSeated = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.SEATED;
  }, [playerData]);
  
  const isSittingOut = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.SITTING_OUT;
  }, [playerData]);

  const isSittingIn = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.SITTING_IN;
  }, [playerData]);
  
  const isBusted = React.useMemo((): boolean => {
    return playerData?.status === PlayerStatus.BUSTED;
  }, [playerData]);
  
  const holeCards = React.useMemo((): string[] => {
    return playerData?.holeCards || [];
  }, [playerData]);
  
  const round = React.useMemo(() => {
    return gameState?.round || null;
  }, [gameState]);

  return {
    playerData,
    stackValue,
    isFolded,
    isAllIn,
    isSeated,
    isSittingOut,
    isSittingIn,
    isBusted,
    holeCards,
    round,
    isLoading,
    error
  };
}; 