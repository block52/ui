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

    /**
     * Callbacks live in a ref so this hook is immune to callers that pass fresh
     * arrow functions on every render — PokerActionPanel does exactly that.
     *
     * Without it, triggerAutoMuck's identity changed every render, the effect below
     * re-ran, and its cleanup cancelled the pending 500ms submit before it could
     * fire. The guard is latched synchronously, so nothing re-armed it and the
     * action silently never happened (#605).
     */
    const callbacksRef = useRef({ onAutoMuckStarted, onAutoMuckComplete, onAutoMuckError });
    useEffect(() => {
        callbacksRef.current = { onAutoMuckStarted, onAutoMuckComplete, onAutoMuckError };
    });

    const triggerAutoMuck = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        callbacksRef.current.onAutoMuckStarted?.();

        try {
            const result = await muckCards(tableId, network);
            callbacksRef.current.onAutoMuckComplete?.(result.hash);
        } catch (error) {
            console.error("Auto-muck failed:", error);
            callbacksRef.current.onAutoMuckError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network]);

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
    }, [hasMuckAction, isUsersTurn, enabled, triggerAutoMuck]);
}
