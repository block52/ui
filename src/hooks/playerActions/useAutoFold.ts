import { useEffect, useRef, useCallback } from "react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { foldHand } from "./foldHand";
import { checkHand } from "./checkHand";
import { getAutoFoldEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";

/**
 * Hook to automatically fold (or check if available) when the player's action timer expires.
 *
 * Auto-fold is enabled by default and can be disabled via URL query param:
 * - ?autofold=false -> disables auto-fold
 * - ?autofold=true or no param -> enables auto-fold (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook will automatically trigger when:
 * 1. The timer has expired (timeRemaining === 0)
 * 2. The user has FOLD or CHECK in their legal actions
 * 3. It is the user's turn
 * 4. An auto-action has not already been triggered for this opportunity
 *
 * Prefers CHECK over FOLD when both are available.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasFoldAction - Whether FOLD is available in legal actions
 * @param hasCheckAction - Whether CHECK is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param timeRemaining - Seconds remaining on the player's action timer
 * @param onAutoActionStarted - Optional callback when auto-action starts
 * @param onAutoActionComplete - Optional callback when auto-action completes
 * @param onAutoActionError - Optional callback when auto-action fails
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoFold(
    tableId: string,
    network: NetworkEndpoints,
    hasFoldAction: boolean,
    hasCheckAction: boolean,
    isUsersTurn: boolean,
    timeRemaining: number,
    onAutoActionStarted?: (action: PlayerActionType.FOLD | PlayerActionType.CHECK) => void,
    onAutoActionComplete?: (action: PlayerActionType.FOLD | PlayerActionType.CHECK, txHash: string) => void,
    onAutoActionError?: (error: Error) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // Track if action is currently in progress to prevent duplicate calls
    const isProcessingRef = useRef<boolean>(false);
    // Check if auto-fold is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoFoldEnabledRef = useRef<boolean>(enabled ?? getAutoFoldEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoFoldEnabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerAutoAction = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        // Prefer check over fold
        const action = hasCheckAction ? PlayerActionType.CHECK : PlayerActionType.FOLD;

        isProcessingRef.current = true;
        onAutoActionStarted?.(action);

        try {
            const result = action === PlayerActionType.CHECK
                ? await checkHand(tableId, network)
                : await foldHand(tableId, network);
            onAutoActionComplete?.(action, result.hash);
        } catch (error) {
            console.error(`Auto-${action} failed:`, error);
            onAutoActionError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, hasCheckAction, onAutoActionStarted, onAutoActionComplete, onAutoActionError]);

    useEffect(() => {
        // Check all conditions for auto-fold
        const canAct = hasFoldAction || hasCheckAction;
        const shouldAutoFold =
            autoFoldEnabledRef.current &&
            canAct &&
            isUsersTurn &&
            timeRemaining === 0 &&
            !hasTriggeredRef.current &&
            !isProcessingRef.current;

        if (shouldAutoFold) {
            hasTriggeredRef.current = true;
            // Small delay to ensure state is stable
            const timeoutId = setTimeout(() => {
                triggerAutoAction();
            }, 500);
            return () => clearTimeout(timeoutId);
        }

        // Reset the trigger flag when it's no longer the user's turn
        // or when timer resets (new action opportunity)
        if (!isUsersTurn || timeRemaining > 0) {
            hasTriggeredRef.current = false;
        }
    }, [hasFoldAction, hasCheckAction, isUsersTurn, timeRemaining, triggerAutoAction]);
}
