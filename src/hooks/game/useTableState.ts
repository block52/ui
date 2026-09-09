import { useMemo } from "react";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameMeta } from "../../context/gameState/GameMetaContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { TexasHoldemRound, GameFormat } from "@block52/poker-vm-sdk";
import { TableStateReturn } from "../../types/index";
import { getGameFormat } from "../../utils/gameFormatUtils";
import { formatMicroAsUsdc } from "../../constants/currency";
import { hasElements } from "../../utils/guards";

/**
 * Custom hook to fetch and provide table state information
 *
 * NOTE: Table state information is handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress
 * and playerId parameters. This hook reads the real-time table state data from that context.
 *
 * @returns Object containing table state properties including round, pot, size, type
 */
export const useTableState = (): TableStateReturn => {
    const { gameState } = useGameData();
    const { gameFormat } = useGameMeta();
    const { isLoading, error } = useGameUI();

    // Memoized on the snapshot rather than recomputed per render: formatMicroAsUsdc
    // and both object literals used to run on every render of all four consumers
    // (Table, PokerActionPanel, useTableBoard, usePlayerLayout), including the many
    // renders not driven by a new snapshot at all.
    //
    // Keyed on `gameState` rather than on the individual fields, because reading
    // gameState.gameOptions.maxPlayers outside the try below would move a required
    // -field error out of the catch and crash the page instead of surfacing it.
    return useMemo<TableStateReturn>(() => {
        // Placeholder while loading / on error. tableSize is 0 — NOT a real seat
        // count. Consumers MUST gate on isLoading/error before reading tableSize;
        // the real value (gameState.gameOptions.maxPlayers) only exists once state
        // has arrived. Fabricating a seat count here caused the 9->real flash (#466).
        const defaultState: TableStateReturn = {
            currentRound: TexasHoldemRound.PREFLOP,
            totalPot: "0",
            formattedTotalPot: "0.00",
            tableSize: 0,
            tableFormat: GameFormat.CASH,
            roundType: TexasHoldemRound.PREFLOP,
            isLoading,
            error
        };

        // If still loading or error occurred, return default values
        if (isLoading || error || !gameState) {
            return defaultState;
        }

        try {
            // Use totalPot from game state (main pot + current round bets)
            // Falls back to pots[0] (main pot) if totalPot not available
            let totalPotWei = "0";
            if (gameState.totalPot) {
                totalPotWei = gameState.totalPot;
            } else if (hasElements(gameState.pots)) {
                totalPotWei = gameState.pots[0];
            }

            // Format total pot value to display format
            const formattedTotalPot = formatMicroAsUsdc(totalPotWei);

            // Extract the current round
            const currentRound = gameState.round || TexasHoldemRound.PREFLOP;

            // Extract table size (maximum players). Required field per SDK —
            // no optional chaining; if it's missing that's a chain bug that
            // must surface, not be masked by a default (12 Commandments #6/#7).
            const tableSize = gameState.gameOptions.maxPlayers;

            // Extract table format
            const tableFormat = getGameFormat(gameFormat);

            const result: TableStateReturn = {
                currentRound,
                totalPot: totalPotWei,
                formattedTotalPot,
                tableSize,
                tableFormat,
                roundType: currentRound,
                isLoading: false,
                error: null
            };

            return result;
        } catch (err) {
            console.error("Error parsing table state:", err);
            return {
                ...defaultState,
                error: err as Error
            };
        }
    }, [gameState, gameFormat, isLoading, error]);
};
