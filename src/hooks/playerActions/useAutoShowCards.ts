import type { NetworkEndpoints } from "../../context/NetworkContext";
import { showCards } from "./showCards";
import { useLatchedDelay } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * Hook to automatically show cards when the player's action timer expires.
 *
 * Triggers once per opportunity when:
 * 1. The timer has expired (timeRemaining === 0)
 * 2. The player has a SHOW action available
 * 3. It is the user's turn
 * 4. The submit queue is idle
 * 5. An auto-action has not already been triggered for this opportunity
 *
 * The show is SUBMITTED through the shared ActionSubmitController (ui#635), not
 * broadcast from here. It stands down while the queue is busy: the controller
 * runs a queued job without re-checking the table, so an automatic action must
 * never wait in line behind one the player already made (see useAutoFold).
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasShowAction - Whether SHOW is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param timeRemaining - Seconds remaining on the player's action timer
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy - Whether the controller has a submission in flight (from useActionSubmit)
 * @param onAutoShowSubmitted - Optional callback with the tx hash once broadcast
 */
export function useAutoShowCards(
    tableId: string,
    network: NetworkEndpoints,
    hasShowAction: boolean,
    isUsersTurn: boolean,
    timeRemaining: number,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onAutoShowSubmitted?: (txHash: string) => void
): void {
    const shouldArm = hasShowAction && isUsersTurn && timeRemaining === 0 && !isBusy;
    // New opportunity: the turn passed, or the clock was reset.
    const shouldReset = !isUsersTurn || timeRemaining > 0;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (!tableId || isBusy) {
            return false;
        }
        submit({ actionName: "show", run: () => showCards(tableId, network), onSuccess: onAutoShowSubmitted });
        return true;
    });
}
