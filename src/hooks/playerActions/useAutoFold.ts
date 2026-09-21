import { useRef } from "react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { foldHand } from "./foldHand";
import { checkHand } from "./checkHand";
import { getAutoFoldEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";
import { useLatchedDelay } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";

/**
 * Hook to automatically fold (or check if available) when the player's action timer expires.
 *
 * Auto-fold is enabled by default and can be disabled via URL query param:
 * - ?autofold=false -> disables auto-fold
 * - ?autofold=true or no param -> enables auto-fold (default)
 *
 * The `enabled` parameter, when provided, overrides the URL query param.
 * It is reactive — toggling it mid-session takes effect immediately.
 *
 * When enabled, this hook will automatically trigger when:
 * 1. The timer has expired (timeRemaining === 0)
 * 2. The user has FOLD or CHECK in their legal actions
 * 3. It is the user's turn
 * 4. The submit queue is idle (see below)
 * 5. An auto-action has not already been triggered for this opportunity
 *
 * Prefers CHECK over FOLD when both are available.
 *
 * The action is SUBMITTED through the shared ActionSubmitController (ui#635),
 * not broadcast from here, so this account has one outbound queue and a
 * rejection is toasted rather than logged.
 *
 * It stands down while that queue is BUSY. The controller runs a queued job as
 * soon as the one ahead of it clears, without re-checking the table — so a fold
 * queued behind the player's own in-flight call would fire after the call
 * landed, and heads-up against a fast opponent could land on their NEXT
 * decision. If they have already acted, the clock running out is not a fold. If
 * that action is rejected and it is still their turn, this re-arms.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param hasFoldAction - Whether FOLD is available in legal actions
 * @param hasCheckAction - Whether CHECK is available in legal actions
 * @param isUsersTurn - Whether it is currently the user's turn
 * @param timeRemaining - Seconds remaining on the player's action timer
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy - Whether the controller has a submission in flight (from useActionSubmit)
 * @param onAutoActionSubmitted - Optional callback with the action + tx hash once broadcast
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useAutoFold(
    tableId: string,
    network: NetworkEndpoints,
    hasFoldAction: boolean,
    hasCheckAction: boolean,
    isUsersTurn: boolean,
    timeRemaining: number,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onAutoActionSubmitted?: (action: PlayerActionType.FOLD | PlayerActionType.CHECK, txHash: string) => void,
    enabled?: boolean
): void {
    const urlDefaultRef = useRef<boolean>(getAutoFoldEnabled());
    const isEnabled = isNullish(enabled) ? urlDefaultRef.current : enabled;

    const shouldArm = isEnabled && (hasFoldAction || hasCheckAction) && isUsersTurn && timeRemaining === 0 && !isBusy;
    // New opportunity: the turn passed, or the clock was reset.
    const shouldReset = !isUsersTurn || timeRemaining > 0;

    useLatchedDelay(shouldArm, shouldReset, () => {
        if (!tableId || isBusy) {
            return false;
        }
        // Prefer check over fold — read at fire time, not when the timer armed.
        const action = hasCheckAction ? PlayerActionType.CHECK : PlayerActionType.FOLD;
        submit({
            actionName: action,
            run: () => (action === PlayerActionType.CHECK ? checkHand(tableId, network) : foldHand(tableId, network)),
            onSuccess: hash => onAutoActionSubmitted?.(action, hash)
        });
        return true;
    });
}
