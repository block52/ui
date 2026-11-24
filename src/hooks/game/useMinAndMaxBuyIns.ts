import { useMemo } from "react";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { MinAndMaxBuyInsReturn } from "@block52/poker-ui-core/types";

/**
 * Custom hook to fetch min and max buy-in values for a table
 *
 * NOTE: Min and max buy-in values are handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress
 * and playerId parameters. This hook reads the real-time buy-in data from that context.
 *
 * Per Commandment 7 (NO Defaults): Returns values directly from chain without any
 * conversion heuristics or default values. If data is missing, returns undefined.
 *
 * @returns Object containing min/max buy-in values in USDC micro-units (6 decimals)
 */
export const useMinAndMaxBuyIns = (): MinAndMaxBuyInsReturn => {
    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();

    const minBuyIn = gameState?.gameOptions?.minBuyIn;
    const maxBuyIn = gameState?.gameOptions?.maxBuyIn;
    const dataReady = !isLoading && !error && !!gameState?.gameOptions;

    return useMemo<MinAndMaxBuyInsReturn>(() => {
        if (!dataReady) {
            return {
                minBuyIn: undefined,
                maxBuyIn: undefined,
                isLoading,
                error
            };
        }
        return {
            minBuyIn,
            maxBuyIn,
            isLoading: false,
            error: null
        };
    }, [dataReady, minBuyIn, maxBuyIn, isLoading, error]);
};
