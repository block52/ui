import type { NetworkEndpoints } from "../../context/NetworkContext";
import { muckCards } from "./muckCards";
import { useLatchedDelay } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * Hook to automatically muck cards at showdown when autoMuck is enabled.
 *
 * The `enabled` parameter is reactive — toggling it mid-session takes effect immediately.
 *
 * Triggers once per opportunity when:
 * 1. `enabled` is true
 * 2. The player has a MUCK action available
 * 3. It is the user's turn
 * 4. The submit queue is idle
 * 5. An auto-action has not already been triggered for this opportunity
 *
 * The muck is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here. It stands down while the queue is busy: the controller
 * runs a queued job without re-checking the table, so an automatic action must
 * never wait in line behind one the player already made (see useAutoFold).
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasMuckAction - Whether MUCK is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy - Whether the controller has a submission in flight (from useActionSubmit)
 * @param onAutoMuckSubmitted - Optional callback with the tx hash once broadcast
 * @param enabled - Whether auto-muck is enabled (reactive; default off)
 */
export function useAutoMuck(
    tableId: string,
    network: NetworkEndpoints,
    hasMuckAction: boolean,
    isUsersTurn: boolean,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onAutoMuckSubmitted?: (txHash: string) => void,
    enabled?: boolean
): void {
    const shouldArm = (enabled ?? false) && hasMuckAction && isUsersTurn && !isBusy;
    // Unlike fold/show this is not clock-driven: the opportunity ends with the turn.
    const shouldReset = !isUsersTurn;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (!tableId || isBusy) {
            return false;
        }
        submit({ actionName: "muck", run: () => muckCards(tableId, network), onSuccess: onAutoMuckSubmitted });
        return true;
    });
}
