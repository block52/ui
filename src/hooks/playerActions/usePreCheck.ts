import type { NetworkEndpoints } from "../../context/NetworkContext";
import { checkHand } from "./checkHand";
import { useLatchedDelay } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";

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
 * The check is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here. If the submit queue is BUSY when the turn arrives, the
 * player has already acted by hand: the intent resolves WITHOUT acting rather
 * than waiting in line, because the controller runs a queued job without
 * re-checking the table and a check that lands late lands on the wrong decision.
 *
 * @param tableId        - The table/game ID
 * @param network        - The network configuration
 * @param queued         - Whether the player has ticked the pre-check box
 * @param hasCheckAction - Whether CHECK is currently in the player's legal actions
 * @param isUsersTurn    - Whether it is currently the player's turn
 * @param submit         - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy         - Whether the controller has a submission in flight
 * @param onSubmitted    - Optional callback with the tx hash once broadcast
 * @param onResolved     - Optional callback fired in every terminal case (handed
 *                         to the controller, or a no-op abort) so the caller can
 *                         clear the queued flag
 */
export function usePreCheck(
    tableId: string,
    network: NetworkEndpoints,
    queued: boolean,
    hasCheckAction: boolean,
    isUsersTurn: boolean,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onSubmitted?: (txHash: string) => void,
    onResolved?: () => void
): void {
    // Fires on the rising edge of the turn; the latch reopens once the turn passes.
    useLatchedDelay(queued && isUsersTurn, !isUsersTurn, () => {
        if (!tableId) {
            return false;
        }
        // Read at FIRE time, not when the turn began: a bet slipped in (CHECK is
        // no longer free), or the player already acted by hand (queue busy).
        // Either way resolve without acting; they get their normal turn.
        if (hasCheckAction && !isBusy) {
            submit({ actionName: "check", run: () => checkHand(tableId, network), onSuccess: onSubmitted });
        }
        // The intent is consumed either way — a failed submit is the
        // controller's to report, and the box must not stay ticked (ui#605).
        onResolved?.();
        return true;
    });
}
