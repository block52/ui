import { useEffect, useRef, useCallback } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { postSmallBlind } from "./postSmallBlind";
import { postBigBlind } from "./postBigBlind";
import { getAutoPostBlindsEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * Hook to automatically post blinds when conditions are met.
 *
 * Auto-post blinds is enabled by default and can be disabled via URL query param:
 * - ?autoblinds=false -> disables auto-post blinds
 * - ?autoblinds=true or no param -> enables auto-post blinds (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook will automatically post the small or big blind when:
 * 1. The user has the SMALL_BLIND or BIG_BLIND action in their legal actions
 * 2. It is the user's turn
 * 3. The blind has not already been posted for this opportunity
 *
 * The blind is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here: every tx this account sends — manual or automatic —
 * goes through one queue, so they dedupe and serialize instead of racing, and
 * a rejection is toasted to the player instead of dying in the console. (The
 * manual "Post Small Blind" button used to appear with no explanation because
 * a rejected auto-post was only ever logged.)
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasSmallBlindAction - Whether the SMALL_BLIND action is available in legal actions
 * @param hasBigBlindAction - Whether the BIG_BLIND action is available in legal actions
 * @param smallBlindAmount - The small blind amount in micro-units as bigint
 * @param bigBlindAmount - The big blind amount in micro-units as bigint
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param onBlindSubmitted - Optional callback with the blind type + tx hash once broadcast
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoPostBlinds(
    tableId: string,
    network: NetworkEndpoints,
    hasSmallBlindAction: boolean,
    hasBigBlindAction: boolean,
    smallBlindAmount: bigint,
    bigBlindAmount: bigint,
    isUsersTurn: boolean,
    submit: (request: SubmitActionRequest) => void,
    onBlindSubmitted?: (blindType: "small" | "big", txHash: string) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered blind posting for this opportunity
    const hasTriggeredSmallBlindRef = useRef<boolean>(false);
    const hasTriggeredBigBlindRef = useRef<boolean>(false);
    // Check if auto-post blinds is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoPostBlindsEnabledRef = useRef<boolean>(enabled ?? getAutoPostBlindsEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoPostBlindsEnabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerPostSmallBlind = useCallback(() => {
        if (!tableId || smallBlindAmount === 0n) {
            return;
        }
        submit({
            actionName: "small-blind",
            run: () => postSmallBlind(tableId, smallBlindAmount, network),
            onSuccess: hash => onBlindSubmitted?.("small", hash)
        });
    }, [tableId, network, smallBlindAmount, submit, onBlindSubmitted]);

    const triggerPostBigBlind = useCallback(() => {
        if (!tableId || bigBlindAmount === 0n) {
            return;
        }
        submit({
            actionName: "big-blind",
            run: () => postBigBlind(tableId, bigBlindAmount, network),
            onSuccess: hash => onBlindSubmitted?.("big", hash)
        });
    }, [tableId, network, bigBlindAmount, submit, onBlindSubmitted]);

    useEffect(() => {
        // Check conditions for auto-post small blind
        const shouldPostSmallBlind =
            autoPostBlindsEnabledRef.current &&
            hasSmallBlindAction &&
            isUsersTurn &&
            !hasTriggeredSmallBlindRef.current;

        if (shouldPostSmallBlind) {
            hasTriggeredSmallBlindRef.current = true;
            triggerPostSmallBlind();
        }

        // Reset the trigger flag when small blind action is no longer available
        if (!hasSmallBlindAction) {
            hasTriggeredSmallBlindRef.current = false;
        }
    }, [hasSmallBlindAction, isUsersTurn, triggerPostSmallBlind]);

    useEffect(() => {
        // Check conditions for auto-post big blind
        const shouldPostBigBlind =
            autoPostBlindsEnabledRef.current &&
            hasBigBlindAction &&
            isUsersTurn &&
            !hasTriggeredBigBlindRef.current;

        if (shouldPostBigBlind) {
            hasTriggeredBigBlindRef.current = true;
            triggerPostBigBlind();
        }

        // Reset the trigger flag when big blind action is no longer available
        if (!hasBigBlindAction) {
            hasTriggeredBigBlindRef.current = false;
        }
    }, [hasBigBlindAction, isUsersTurn, triggerPostBigBlind]);
}
