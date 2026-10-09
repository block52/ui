import type { NetworkEndpoints } from "../../context/NetworkContext";
import { checkHand } from "./checkHand";
import { foldHand } from "./foldHand";
import { useLatchedDelay } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * Pre-select "Check/Fold" (ui#388).
 *
 * The *pre-action* sibling of useAutoFold (which fires on timer expiry). When the
 * player has queued Check/Fold and action reaches them, this auto-submits once,
 * with the standard online-poker meaning:
 *
 *   - CHECK if checking is free;
 *   - otherwise FOLD, but only when the player is genuinely facing a bet (CALL is
 *     legal). FOLD alone is not enough: the engine offers fold-anytime, including
 *     on a blind-posting turn, and Check/Fold must never fold a player out of a
 *     hand they have not been bet into;
 *   - otherwise resolve WITHOUT acting, so the player takes their normal turn.
 *
 * Fires on the RISING EDGE of the player's turn and re-reads the legal actions
 * the moment it fires, never the values from when the turn began. See ui#430 on
 * the hazard of auto-acting against stale state.
 *
 * The action is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here. If the submit queue is BUSY when the turn arrives, the
 * player has already acted by hand: the intent resolves WITHOUT acting rather
 * than waiting in line, because the controller runs a queued job without
 * re-checking the table and an action that lands late lands on the wrong decision.
 *
 * @param tableId        - The table/game ID
 * @param network        - The network configuration
 * @param queued         - Whether the player has ticked the Check/Fold box
 * @param hasCheckAction - Whether CHECK is currently in the player's legal actions
 * @param hasCallAction  - Whether CALL is currently legal (the player faces a bet)
 * @param hasFoldAction  - Whether FOLD is currently in the player's legal actions
 * @param isUsersTurn    - Whether it is currently the player's turn
 * @param submit         - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy         - Whether the controller has a submission in flight
 * @param onSubmitted    - Optional callback with the tx hash once broadcast
 * @param onResolved     - Optional callback fired in every terminal case (handed
 *                         to the controller, or a no-op abort) so the caller can
 *                         clear the queued flag
 */
export function usePreCheckFold(
    tableId: string,
    network: NetworkEndpoints,
    queued: boolean,
    hasCheckAction: boolean,
    hasCallAction: boolean,
    hasFoldAction: boolean,
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
        // Read at FIRE time, not when the turn began. If the player already acted
        // by hand (queue busy), or there is neither a free check nor a bet to fold
        // to (e.g. a blind-posting turn), resolve without acting.
        if (!isBusy) {
            if (hasCheckAction) {
                submit({ actionName: "check", run: () => checkHand(tableId, network), onSuccess: onSubmitted });
            } else if (hasCallAction && hasFoldAction) {
                submit({ actionName: "fold", run: () => foldHand(tableId, network), onSuccess: onSubmitted });
            }
        }
        // The intent is consumed either way — a failed submit is the
        // controller's to report, and the box must not stay ticked (ui#605).
        onResolved?.();
        return true;
    });
}
