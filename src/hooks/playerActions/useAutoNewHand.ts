import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { startNewHand } from "./startNewHand";
import { getAutoNewHandEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";

/**
 * Hook to automatically trigger new hand when the current hand ends.
 *
 * Auto-new-hand is enabled by default and can be disabled via URL query param:
 * - ?autonewhand=false -> disables auto-new-hand
 * - ?autonewhand=true or no param -> enables auto-new-hand (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook will automatically trigger the new hand action when:
 * 1. The user has the NEW_HAND action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-new-hand has not already been triggered for this opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasNewHandAction - Whether the NEW_HAND action is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onNewHandStarted - Optional callback when auto-new-hand starts
 * @param onNewHandComplete - Optional callback when auto-new-hand completes
 * @param onNewHandError - Optional callback when auto-new-hand fails
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoNewHand(
    tableId: string,
    network: NetworkEndpoints,
    hasNewHandAction: boolean,
    isUsersTurn: boolean,
    onNewHandStarted?: () => void,
    onNewHandComplete?: (txHash: string) => void,
    onNewHandError?: (error: Error) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered new hand for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // Track if new hand is currently in progress to prevent duplicate calls
    const isProcessingRef = useRef<boolean>(false);
    // Check if auto-new-hand is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoNewHandEnabledRef = useRef<boolean>(enabled ?? getAutoNewHandEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoNewHandEnabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerAutoNewHand = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onNewHandStarted?.();

        try {
            const result = await startNewHand(tableId, network);
            onNewHandComplete?.(result.hash);
        } catch (error) {
            console.error("Auto-new-hand failed:", error);
            onNewHandError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onNewHandStarted, onNewHandComplete, onNewHandError]);

    useEffect(() => {
        // Check all conditions for auto-new-hand
        const shouldAutoNewHand =
            autoNewHandEnabledRef.current &&
            hasNewHandAction &&
            isUsersTurn &&
            !hasTriggeredRef.current &&
            !isProcessingRef.current;

        if (shouldAutoNewHand) {
            hasTriggeredRef.current = true;
            triggerAutoNewHand();
        }

        // Reset the trigger flag when new hand action is no longer available
        // This allows auto-new-hand to trigger again on the next opportunity
        if (!hasNewHandAction) {
            hasTriggeredRef.current = false;
        }
    }, [hasNewHandAction, isUsersTurn, triggerAutoNewHand]);
}
