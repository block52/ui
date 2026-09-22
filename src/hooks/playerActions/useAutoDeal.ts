import { useEffect, useRef, useCallback, useState } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { dealCardsWithEntropy } from "./dealCards";
import { getAutoDealEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";
import { MAX_AUTO_REARMS, shouldRearmAfterFailure } from "./autoActionRearm";

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
 * The deal is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here: every tx this account sends — manual or automatic —
 * goes through one queue, so they dedupe and serialize instead of racing, and
 * a rejection is toasted to the player instead of dying in the console.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasDealAction - Whether the DEAL action is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param onDealSubmitted - Optional callback with the tx hash once broadcast
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoDeal(
    tableId: string,
    network: NetworkEndpoints,
    hasDealAction: boolean,
    isUsersTurn: boolean,
    submit: (request: SubmitActionRequest) => void,
    onDealSubmitted?: (txHash: string) => void,
    enabled?: boolean
): void {
    // Track if we've already triggered deal for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // ui#655: re-arms spent on the current opportunity, and the tick that makes
    // a re-arm re-run the gate below (a ref alone would not).
    const rearmCountRef = useRef<number>(0);
    const [rearmToken, setRearmToken] = useState<number>(0);
    // Check if auto-deal is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoDealEnabledRef = useRef<boolean>(enabled ?? getAutoDealEnabled());

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoDealEnabledRef.current = enabled;
        }
    }, [enabled]);

    // ui#655: a failed deal must not hold the latch for the rest of the
    // opportunity. Clearing it re-runs the effect, which revalidates the turn
    // and the legal action before anything is submitted again.
    const rearmAfterFailure = useCallback((error: SubmitError) => {
        if (!shouldRearmAfterFailure(error) || rearmCountRef.current >= MAX_AUTO_REARMS) {
            return;
        }
        rearmCountRef.current += 1;
        hasTriggeredRef.current = false;
        setRearmToken(token => token + 1);
    }, []);

    const triggerAutoDeal = useCallback((): boolean => {
        if (!tableId) {
            return false;
        }
        submit({
            actionName: "deal",
            run: () => dealCardsWithEntropy(tableId, network, ""),
            onSuccess: onDealSubmitted,
            onFailure: rearmAfterFailure
        });
        return true;
    }, [tableId, network, submit, onDealSubmitted, rearmAfterFailure]);

    useEffect(() => {
        // Check all conditions for auto-deal
        const shouldAutoDeal =
            autoDealEnabledRef.current &&
            hasDealAction &&
            isUsersTurn &&
            !hasTriggeredRef.current;

        if (shouldAutoDeal) {
            // ui#662: latch on the SUBMISSION, not the intent — a render with no
            // table id yet used to burn the one shot for the whole opportunity.
            if (triggerAutoDeal()) {
                hasTriggeredRef.current = true;
            }
        }

        // Reset the trigger flag when deal action is no longer available
        // This allows auto-deal to trigger again on the next hand
        if (!hasDealAction) {
            hasTriggeredRef.current = false;
            rearmCountRef.current = 0;
        }
    }, [hasDealAction, isUsersTurn, triggerAutoDeal, rearmToken]);
}
