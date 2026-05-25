import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { hasContent } from "../../utils/guards";
import { isSeatBigBlind } from "../../utils/playerSeatUtils";
import { sitOut, SIT_OUT_METHOD_NEXT_HAND } from "./sitOut";

/**
 * Client-side "Sit Out Next Big Blind".
 *
 * The chain does not yet implement `SIT_OUT method=next-bb` (poker-vm#1895),
 * so this hook holds the intent in the browser and fires a standard
 * `SIT_OUT method=next-hand` the moment the big blind rotates onto the
 * player's seat. The player plays out the BB hand, then sits out from the
 * following hand.
 *
 * Mirrors `useAutoFold`: the parent owns the enable flag and clears it via
 * `onComplete` once the action fires, so the checkbox visibly unchecks.
 *
 * Single-shot per BB landing: `hasTriggeredRef` arms again only when the
 * BB moves off the player's seat (new hand).
 */
export function useAutoSitOutNextBB(
    tableId: string | undefined,
    network: NetworkEndpoints,
    userSeat: number | undefined,
    bigBlindPosition: number | undefined,
    enabled: boolean,
    onComplete?: () => void,
    onError?: (error: Error) => void
): void {
    const hasTriggeredRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);

    const triggerSitOut = useCallback(async () => {
        if (!hasContent(tableId) || isProcessingRef.current) return;

        isProcessingRef.current = true;
        try {
            await sitOut(tableId, network, SIT_OUT_METHOD_NEXT_HAND);
            onComplete?.();
        } catch (error) {
            console.error("Auto sit-out-next-BB failed:", error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            isProcessingRef.current = false;
        }
    }, [tableId, network, onComplete, onError]);

    useEffect(() => {
        const seatIsBB = isSeatBigBlind(userSeat, bigBlindPosition);

        const shouldFire =
            enabled &&
            seatIsBB &&
            !hasTriggeredRef.current &&
            !isProcessingRef.current;

        if (shouldFire) {
            hasTriggeredRef.current = true;
            triggerSitOut();
            return;
        }

        if (!seatIsBB) {
            hasTriggeredRef.current = false;
        }
    }, [enabled, userSeat, bigBlindPosition, triggerSitOut]);
}
