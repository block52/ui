import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { showCards } from "./showCards";

/**
 * Hook to automatically show cards when the player's action timer expires.
 *
 * Triggers once per opportunity when:
 * 1. The timer has expired (timeRemaining === 0)
 * 2. The player has a SHOW action available
 * 3. It is the user's turn
 * 4. An auto-action has not already been triggered for this opportunity
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasShowAction - Whether SHOW is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param timeRemaining - Seconds remaining on the player's action timer
 * @param onAutoShowStarted - Optional callback when auto-show starts
 * @param onAutoShowComplete - Optional callback when auto-show completes
 * @param onAutoShowError - Optional callback when auto-show fails
 */
export function useAutoShowCards(
    tableId: string,
    network: NetworkEndpoints,
    hasShowAction: boolean,
    isUsersTurn: boolean,
    timeRemaining: number,
    onAutoShowStarted?: () => void,
    onAutoShowComplete?: (txHash: string) => void,
    onAutoShowError?: (error: Error) => void
): void {
    const hasTriggeredRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);

    const triggerAutoShow = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        onAutoShowStarted?.();

        try {
            const result = await showCards(tableId, network);
            onAutoShowComplete?.(result.hash);
        } catch (error) {
            console.error("Auto-show cards failed:", error);
            onAutoShowError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onAutoShowStarted, onAutoShowComplete, onAutoShowError]);

    useEffect(() => {
        const shouldAutoShow = hasShowAction && isUsersTurn && timeRemaining === 0 && !hasTriggeredRef.current && !isProcessingRef.current;

        console.log("useAutoShowCards conditions:", shouldAutoShow);
        if (shouldAutoShow) {
            hasTriggeredRef.current = true;
            const timeoutId = setTimeout(() => {
                triggerAutoShow();
            }, 500);
            return () => clearTimeout(timeoutId);
        }

        // Reset when it's no longer the user's turn or timer resets
        if (!isUsersTurn || timeRemaining > 0) {
            hasTriggeredRef.current = false;
        }
    }, [hasShowAction, isUsersTurn, timeRemaining, triggerAutoShow]);
}
