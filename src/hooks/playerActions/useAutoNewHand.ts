import { useEffect, useRef, useCallback, useState } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { startNewHand } from "./startNewHand";
import { getLatestGameState } from "./transportAction";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { getAutoNewHandEnabled } from "../../utils/urlParams";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { isNullish } from "../../utils/guards";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";

/**
 * Hook to automatically trigger a new hand when the current hand ends.
 *
 * Auto-new-hand is enabled by default and can be disabled via URL query param:
 * - ?autonewhand=false -> disables auto-new-hand
 * - ?autonewhand=true or no param -> enables auto-new-hand (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook triggers the new-hand action when:
 * 1. The user has the NEW_HAND action in their legal actions
 * 2. It is the user's turn
 * 3. Auto-new-hand has not already been triggered for this opportunity
 *
 * WS Action Bus note — showdown pacing lives in the bus, not here.
 * The hook no longer runs its own 2000ms pre-deal timer (the old ui#443 hack).
 * Showdown visibility is now owned by the
 * `showdownHold` decorator, which holds the RENDERED track for SHOWDOWN_HOLD_MS
 * after a `handEnded` commit, keeping the winner banner up while the next hand
 * deals behind it.
 *
 * Because dealing a new hand is an action SUBMISSION, its trigger inputs
 * (`hasNewHandAction` / `isUsersTurn`) are derived from the LOGICAL track
 * (getLatestGameState — the freshest ingested snapshot), NOT the paced rendered
 * state. This is the plan's two-track invariant: submission decisions must never
 * read paced state, or a delayed rendered snapshot would submit against a stale
 * action index. The committed bus item (useGameEventsContext) is used only as the
 * reactive tick that re-runs the check on each commit; the DATA it reads is
 * always the logical snapshot. So the deal fires promptly while the rendered
 * showdown holds — the two are decoupled and never double-delay.
 *
 * The new hand is SUBMITTED through the shared ActionSubmitController (ui#635),
 * not broadcast from here: every tx this account sends — manual or automatic —
 * goes through one queue, so they dedupe and serialize instead of racing, and
 * a rejection is toasted to the player instead of dying in the console.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param lastError - The controller's latest surfaced error (from useActionSubmit);
 *                    a new-hand failure drops the dealing indicator
 * @param onNewHandSubmitted - Optional callback with the tx hash once broadcast
 * @param enabled - Optional override for the URL param setting (reactive)
 * @returns `{ isDealingNewHand }` — true from the handEnded commit until the next
 *          hand starts (or the deal fails), so the UI can show a
 *          "Dealing hand #X…" indicator during the showdown hold.
 */
export function useAutoNewHand(
    tableId: string,
    network: NetworkEndpoints,
    submit: (request: SubmitActionRequest) => void,
    lastError: SubmitError | null,
    onNewHandSubmitted?: (txHash: string) => void,
    enabled?: boolean
): { isDealingNewHand: boolean } {
    // Track if we've already triggered new hand for this opportunity
    const hasTriggeredRef = useRef<boolean>(false);
    // Check if auto-new-hand is enabled — prefer the reactive `enabled` prop, fall back to URL param
    const autoNewHandEnabledRef = useRef<boolean>(enabled ?? getAutoNewHandEnabled());
    // Drives the "Dealing hand #X…" indicator (showdown hold + deal request).
    const [isDealingNewHand, setIsDealingNewHand] = useState<boolean>(false);

    // Local player address — read once (localStorage is synchronous). Used to
    // resolve the local player's legal actions on the logical track.
    const [localAddress] = useState<string | null>(
        () => localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase() ?? null
    );

    // Reactive tick: re-run the deal check on every committed bus item. The item
    // itself is NOT read for the decision — getLatestGameState() (logical track)
    // is — it is only the signal that a new frame has arrived.
    const { latestItem } = useGameEventsContext();

    // Keep the ref up-to-date when the reactive `enabled` prop changes
    useEffect(() => {
        if (!isNullish(enabled)) {
            autoNewHandEnabledRef.current = enabled;
        }
    }, [enabled]);

    const triggerAutoNewHand = useCallback(() => {
        if (!tableId) {
            return;
        }
        // isDealingNewHand stays true after a successful broadcast — it is
        // cleared by the effect below when the next hand starts, so the
        // indicator covers the whole showdown hold, not just the submission.
        submit({
            actionName: "new-hand",
            run: () => startNewHand(tableId, network),
            onSuccess: onNewHandSubmitted
        });
    }, [tableId, network, submit, onNewHandSubmitted]);

    // A failed deal — the controller has already told the player — must not
    // leave "Dealing hand #X…" up forever. Keyed on the error OBJECT: the
    // controller keeps its last error around, so a stale one must not clear the
    // indicator again on a later hand.
    useEffect(() => {
        if (lastError?.actionName === "new-hand") {
            setIsDealingNewHand(false);
        }
    }, [lastError]);

    useEffect(() => {
        // `latestItem` is the reactive tick only; the decision reads the LOGICAL
        // track so the deal is never delayed by rendered pacing.
        void latestItem;
        const snapshot = getLatestGameState();
        const localPlayer = snapshot?.players?.find(player => player.address?.toLowerCase() === localAddress);
        const hasNewHandAction = !!localPlayer?.legalActions?.some(action => action.action === NonPlayerActionType.NEW_HAND);
        const isUsersTurn = !!localPlayer && snapshot?.nextToAct === localPlayer.seat;

        const shouldAutoNewHand =
            autoNewHandEnabledRef.current &&
            hasNewHandAction &&
            isUsersTurn &&
            !hasTriggeredRef.current;

        if (shouldAutoNewHand) {
            hasTriggeredRef.current = true;
            // Surface the "Dealing hand #X…" indicator, then deal immediately —
            // the showdownHold decoration keeps the showdown visible on the
            // rendered track while the next hand deals behind it.
            setIsDealingNewHand(true);
            triggerAutoNewHand();
        }

        // New-hand opportunity gone (a hand started — by us or another player).
        // Reset so the next END re-arms, and drop the dealing indicator.
        if (!hasNewHandAction) {
            hasTriggeredRef.current = false;
            setIsDealingNewHand(false);
        }
    }, [latestItem, localAddress, triggerAutoNewHand]);

    return { isDealingNewHand };
}
