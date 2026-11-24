import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerDTO, TexasHoldemRound, GameFormat } from "@block52/poker-vm-sdk";
import { TableDataReturn } from "@block52/poker-ui-core/types";
import { getGameFormat } from "@block52/poker-ui-core/utils/gameFormatUtils";

/**
 * Custom hook to provide formatted table data
 *
 * NOTE: Table data is handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress
 * and playerId parameters. This hook reads the real-time table data from that context.
 *
 * @returns Object containing formatted table data and loading/error states
 */
export const useTableData = (): TableDataReturn => {
  // Get game state directly from Context - real-time data via WebSocket
  const { gameState, gameFormat, isLoading, error } = useGameStateContext();

  // Memoize the processed table data
  const tableData = useMemo((): Omit<TableDataReturn, "isLoading" | "error"> => {
    // Default empty state
    const defaultData = {
      tableDataType: GameFormat.CASH,
      tableDataSmallBlind: "0.00",
      tableDataBigBlind: "0.00",
      tableDataSmallBlindPosition: 0,
      tableDataBigBlindPosition: 0,
      tableDataDealer: 0,
      tableDataPlayers: [] as PlayerDTO[],
      tableDataCommunityCards: [] as string[],
      tableDataDeck: "",
      tableDataPots: ["0"],
      tableDataNextToAct: -1,
      tableDataRound: TexasHoldemRound.PREFLOP,
      tableDataWinners: [] as string[],
      tableDataSignature: ""
    };

    if (!gameState) {
      return defaultData;
    }

    // Extract data directly from the SDK DTO structure
    // Per Commandment 7: NO fallback defaults. Trust the chain data.
    // Required fields are used directly — if missing, it's a chain bug.
    // Optional DTO fields (smallBlindPosition, bigBlindPosition, dealer)
    // are legitimately undefined before a hand starts.
    return {
      tableDataType: getGameFormat(gameFormat),
      tableDataSmallBlind: gameState.gameOptions.smallBlind,
      tableDataBigBlind: gameState.gameOptions.bigBlind,
      tableDataSmallBlindPosition: gameState.smallBlindPosition,
      tableDataBigBlindPosition: gameState.bigBlindPosition,
      tableDataDealer: gameState.dealer,
      tableDataPlayers: gameState.players,
      tableDataCommunityCards: gameState.communityCards,
      tableDataDeck: gameState.deck,
      tableDataPots: gameState.pots,
      tableDataNextToAct: gameState.nextToAct,
      tableDataRound: gameState.round,
      tableDataWinners: gameState.winners.map(winner => winner.address),
      tableDataSignature: gameState.signature
    };
  }, [gameState, gameFormat]);

  return {
    ...tableData,
    isLoading,
    error
  };
};
