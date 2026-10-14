import type { NetworkEndpoints } from "../../context/NetworkContext";
import { checkHand } from "./checkHand";
import { foldHand } from "./foldHand";
import { callHand } from "./callHand";
import { useLatchedDelay } from "./useLatchedDelay";
import { resolvePreAction, PreAction, PreActionLegal } from "../../utils/preActions";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * The pre-action bar's firing hook (ui#388), CoinPoker-style. When the player has
 * armed a pre-action (Check/Fold, Check, Call {amount}, or Call Any) and action
 * reaches them, this auto-submits the resolved move exactly once:
 *
 *   - CHECK if checking is free;
 *   - FOLD only when genuinely facing a bet (Check/Fold);
 *   - CALL the current amount for the call pre-actions;
 *   - otherwise resolve WITHOUT acting, so the player takes their normal turn.
 *
 * Fires on the RISING EDGE of the player's turn and re-reads the legal actions and
 * call amount the moment it fires, never the values from when the turn began (see
 * ui#430 on auto-acting against stale state). The action is SUBMITTED through the
 * shared ActionSubmitController (ui#635); if the queue is BUSY when the turn
 * arrives (the player already acted by hand), the intent resolves without acting.
 */
export function usePreAction(
    tableId: string,
    network: NetworkEndpoints,
    action: PreAction | null,
    legal: PreActionLegal,
    callAmountMicro: bigint,
    isUsersTurn: boolean,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onSubmitted?: (txHash: string) => void,
    onResolved?: () => void
): void {
    useLatchedDelay(action != null && isUsersTurn, !isUsersTurn, () => {
        if (!tableId) {
            return false;
        }
        if (!isBusy && action != null) {
            const resolved = resolvePreAction(action, legal);
            if (resolved === "check") {
                submit({ actionName: "check", run: () => checkHand(tableId, network), onSuccess: onSubmitted });
            } else if (resolved === "fold") {
                submit({ actionName: "fold", run: () => foldHand(tableId, network), onSuccess: onSubmitted });
            } else if (resolved === "call") {
                submit({ actionName: "call", run: () => callHand(tableId, callAmountMicro, network), onSuccess: onSubmitted });
            }
        }
        // The intent is consumed either way — a failed submit is the controller's to
        // report, and the armed button must not stay ticked (ui#605).
        onResolved?.();
        return true;
    });
}
