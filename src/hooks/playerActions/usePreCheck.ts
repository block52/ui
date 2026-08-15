import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { checkHand } from "./checkHand";

/**
 * Pre-select "Check" (ui#388).
 *
 * The *pre-action* sibling of useAutoFold (which fires on timer expiry). When the
 * player has queued a pre-check and action reaches them with CHECK still legal,
 * this auto-submits CHECK once.
 *
 * Fires on the RISING EDGE of the player's turn. It re-reads the engine's own
 * legal actions the moment it fires: if a bet slipped in and CHECK is no longer
 * free, it resolves WITHOUT acting so the player takes their normal turn (never
 * an auto-fold — this control can only ever check). See ui#430 on the hazard of
 * auto-acting against stale state.
 *
 * @param tableId        - The table/game ID
 * @param network        - The network configuration
 * @param queued         - Whether the player has ticked the pre-check box
 * @param hasCheckAction - Whether CHECK is currently in the player's legal actions
 * @param isUsersTurn    - Whether it is currently the player's turn
 * @param onStarted      - Optional callback when the auto-check submit starts
 * @param onComplete     - Optional callback when the auto-check submit succeeds
 * @param onError        - Optional callback when the auto-check submit fails
 * @param onResolved     - Optional callback fired in every terminal case (submit
 *                         success/failure, or a no-op abort) so the caller can
 *                         clear the queued flag
 */
export function usePreCheck(
    tableId: string,
    network: NetworkEndpoints,
    queued: boolean,
    hasCheckAction: boolean,
    isUsersTurn: boolean,
    onStarted?: () => void,
    onComplete?: (txHash: string) => void,
    onError?: (error: Error) => void,
    onResolved?: () => void
): void {
    // One fire per turn opportunity.
    const hasTriggeredRef = useRef<boolean>(false);
    // Guard against overlapping submits.
    const isProcessingRef = useRef<boolean>(false);
    // Read the freshest legality inside the delayed fire, not the stale closure.
    const hasCheckRef = useRef<boolean>(hasCheckAction);
    useEffect(() => {
        hasCheckRef.current = hasCheckAction;
    }, [hasCheckAction]);

    const fire = useCallback(async () => {
        if (!tableId || isProcessingRef.current) {
            return;
        }

        // A bet slipped in on the same tick → CHECK is no longer free. Resolve
        // without acting; the player gets their normal turn.
        if (!hasCheckRef.current) {
            onResolved?.();
            return;
        }

        isProcessingRef.current = true;
        onStarted?.();

        try {
            const result = await checkHand(tableId, network);
            onComplete?.(result.hash);
        } catch (error) {
            console.error("Pre-check failed:", error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
            onResolved?.();
        }
    }, [tableId, network, onStarted, onComplete, onError, onResolved]);

    useEffect(() => {
        const shouldFire =
            queued && isUsersTurn && !hasTriggeredRef.current && !isProcessingRef.current;

        if (shouldFire) {
            hasTriggeredRef.current = true;
            // Small delay so state settles before we read legality (mirrors useAutoFold).
            const timeoutId = setTimeout(() => {
                fire();
            }, 500);
            return () => clearTimeout(timeoutId);
        }

        // Reset the latch once the turn passes, ready for the next opportunity.
        if (!isUsersTurn) {
            hasTriggeredRef.current = false;
        }
    }, [queued, isUsersTurn, fire]);
}
