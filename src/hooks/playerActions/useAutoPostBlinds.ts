import { useEffect, useRef, useCallback, useState } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { postSmallBlind } from "./postSmallBlind";
import { postBigBlind } from "./postBigBlind";
import { getAutoPostBlindsEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";
import { MAX_AUTO_REARMS, shouldRearmAfterFailure } from "./autoActionRearm";

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
    // ui#655: re-arms spent on the current opportunity, per blind, and the tick
    // that makes a re-arm re-run the gate below (a ref alone would not).
    const smallBlindRearmsRef = useRef<number>(0);
    const bigBlindRearmsRef = useRef<number>(0);
    const [smallBlindRearmToken, setSmallBlindRearmToken] = useState<number>(0);
    const [bigBlindRearmToken, setBigBlindRearmToken] = useState<number>(0);
    // Check if auto-post blinds is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoPostBlindsEnabledRef = useRef<boolean>(enabled ?? getAutoPostBlindsEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoPostBlindsEnabledRef.current = enabled;
        }
    }, [enabled]);

    // ui#655: a rejected auto-post used to hold the latch for the rest of the
    // opportunity, so "Post Small Blind 25" sat there over a pot of 0 with no way
    // forward but a manual click or a refresh. Clearing the latch re-runs the
    // effect, which revalidates turn and legal action before re-submitting.
    const rearmSmallBlind = useCallback((error: SubmitError) => {
        if (!shouldRearmAfterFailure(error) || smallBlindRearmsRef.current >= MAX_AUTO_REARMS) {
            return;
        }
        smallBlindRearmsRef.current += 1;
        hasTriggeredSmallBlindRef.current = false;
        setSmallBlindRearmToken(token => token + 1);
    }, []);

    const rearmBigBlind = useCallback((error: SubmitError) => {
        if (!shouldRearmAfterFailure(error) || bigBlindRearmsRef.current >= MAX_AUTO_REARMS) {
            return;
        }
        bigBlindRearmsRef.current += 1;
        hasTriggeredBigBlindRef.current = false;
        setBigBlindRearmToken(token => token + 1);
    }, []);

    const triggerPostSmallBlind = useCallback((): boolean => {
        if (!tableId || smallBlindAmount === 0n) {
            return false;
        }
        submit({
            actionName: "small-blind",
            run: () => postSmallBlind(tableId, smallBlindAmount, network),
            onSuccess: hash => onBlindSubmitted?.("small", hash),
            onFailure: rearmSmallBlind
        });
        return true;
    }, [tableId, network, smallBlindAmount, submit, onBlindSubmitted, rearmSmallBlind]);

    const triggerPostBigBlind = useCallback((): boolean => {
        if (!tableId || bigBlindAmount === 0n) {
            return false;
        }
        submit({
            actionName: "big-blind",
            run: () => postBigBlind(tableId, bigBlindAmount, network),
            onSuccess: hash => onBlindSubmitted?.("big", hash),
            onFailure: rearmBigBlind
        });
        return true;
    }, [tableId, network, bigBlindAmount, submit, onBlindSubmitted, rearmBigBlind]);

    useEffect(() => {
        // Check conditions for auto-post small blind
        const shouldPostSmallBlind =
            autoPostBlindsEnabledRef.current &&
            hasSmallBlindAction &&
            isUsersTurn &&
            !hasTriggeredSmallBlindRef.current;

        if (shouldPostSmallBlind) {
            // ui#662: consume the opportunity only when a submission is actually made.
            // Latching first burned the one shot on a render where the amount or the
            // table id had not arrived yet — the callback returned without submitting,
            // and the later render carrying a real amount found the latch already set,
            // so the blind never posted and the manual button sat there.
            if (triggerPostSmallBlind()) {
                hasTriggeredSmallBlindRef.current = true;
            }
        }

        // Reset the trigger flag when small blind action is no longer available
        if (!hasSmallBlindAction) {
            hasTriggeredSmallBlindRef.current = false;
            smallBlindRearmsRef.current = 0;
        }
    }, [hasSmallBlindAction, isUsersTurn, triggerPostSmallBlind, smallBlindRearmToken]);

    useEffect(() => {
        // Check conditions for auto-post big blind
        const shouldPostBigBlind =
            autoPostBlindsEnabledRef.current &&
            hasBigBlindAction &&
            isUsersTurn &&
            !hasTriggeredBigBlindRef.current;

        if (shouldPostBigBlind) {
            // ui#662: see the small-blind effect — latch on submission, not on intent.
            if (triggerPostBigBlind()) {
                hasTriggeredBigBlindRef.current = true;
            }
        }

        // Reset the trigger flag when big blind action is no longer available
        if (!hasBigBlindAction) {
            hasTriggeredBigBlindRef.current = false;
            bigBlindRearmsRef.current = 0;
        }
    }, [hasBigBlindAction, isUsersTurn, triggerPostBigBlind, bigBlindRearmToken]);
}
