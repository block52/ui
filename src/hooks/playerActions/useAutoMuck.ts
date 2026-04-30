import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { muckCards } from "./muckCards";
import { isNullish } from "../../utils/guards";

/**
 * Hook to automatically muck cards at showdown when autoMuck is enabled.
 *
 * The `enabled` parameter is reactive — toggling it mid-session takes effect immediately.
 *
 * Triggers once per opportunity when:
 * 1. `enabled` is true
 * 2. The player has a MUCK action available
 * 3. It is the user's turn
 * 4. An auto-action has not already been triggered for this opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasMuckAction - Whether MUCK is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onAutoMuckStarted - Optional callback when auto-muck starts
 * @param onAutoMuckComplete - Optional callback when auto-muck completes
 * @param onAutoMuckError - Optional callback when auto-muck fails
 * @param enabled - Whether auto-muck is enabled (reactive)
 */
export function useAutoMuck(
    tableId: string,
    network: NetworkEndpoints,
    hasMuckAction: boolean,
    isUsersTurn: boolean,
    onAutoMuckStarted?: () => void,
    onAutoMuckComplete?: (txHash: string) => void,
    onAutoMuckError?: (error: Error) => void,
    enabled?: boolean
): void {
    const hasTriggeredRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);
    const enabledRef = useRef<boolean>(enabled ?? false);

    useEffect(() => {
        if (!isNullish(enabled)) {
            enabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerAutoMuck = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onAutoMuckStarted?.();

        try {
            const result = await muckCards(tableId, network);
            onAutoMuckComplete?.(result.hash);
        } catch (error) {
            console.error("Auto-muck failed:", error);
            onAutoMuckError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onAutoMuckStarted, onAutoMuckComplete, onAutoMuckError]);

    useEffect(() => {
        const shouldAutoMuck =
            enabledRef.current &&
            hasMuckAction &&
            isUsersTurn &&
            !hasTriggeredRef.current &&
            !isProcessingRef.current;

        if (shouldAutoMuck) {
            hasTriggeredRef.current = true;
            const timeoutId = setTimeout(() => {
                triggerAutoMuck();
            }, 500);
            return () => clearTimeout(timeoutId);
        }

        if (!isUsersTurn) {
            hasTriggeredRef.current = false;
        }
    }, [hasMuckAction, isUsersTurn, triggerAutoMuck]);
}
