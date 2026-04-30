import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { dealCardsWithEntropy } from "./dealCards";
import { getAutoDealEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";

/**
 * Hook to automatically trigger deal action when conditions are met.
 *
 * Auto-deal is enabled by default and can be disabled via URL query param:
 * - ?autodeal=false -> disables auto-deal
 * - ?autodeal=true or no param -> enables auto-deal (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook will automatically trigger the deal action when:
 * 1. The user has the DEAL action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-deal has not already been triggered for this deal opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasDealAction - Whether the DEAL action is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param onDealStarted - Optional callback when auto-deal starts
 * @param onDealComplete - Optional callback when auto-deal completes
 * @param onDealError - Optional callback when auto-deal fails
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoDeal(
    tableId: string,
    network: NetworkEndpoints,
    hasDealAction: boolean,
    isUsersTurn: boolean,
    onDealStarted?: () => void,
    onDealComplete?: (txHash: string) => void,
    onDealError?: (error: Error) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered deal for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // Track if deal is currently in progress to prevent duplicate calls
    const isProcessingRef = useRef<boolean>(false);
    // Check if auto-deal is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoDealEnabledRef = useRef<boolean>(enabled ?? getAutoDealEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoDealEnabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerAutoDeal = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onDealStarted?.();

        try {
            const result = await dealCardsWithEntropy(tableId, network, "");
            onDealComplete?.(result.hash);
        } catch (error) {
            console.error("❌ Auto-deal failed:", error);
            onDealError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onDealStarted, onDealComplete, onDealError]);

    useEffect(() => {
        // Check all conditions for auto-deal
        const shouldAutoDeal =
            autoDealEnabledRef.current &&
            hasDealAction &&
            isUsersTurn &&
            !hasTriggeredRef.current &&
            !isProcessingRef.current;

        if (shouldAutoDeal) {
            hasTriggeredRef.current = true;
            triggerAutoDeal();
        }

        // Reset the trigger flag when deal action is no longer available
        // This allows auto-deal to trigger again on the next hand
        if (!hasDealAction) {
            hasTriggeredRef.current = false;
        }
    }, [hasDealAction, isUsersTurn, triggerAutoDeal]);
}
