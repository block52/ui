/**
 * Confirmation gate — the pure "did our action land?" check.
 *
 * Extracted from the dirty-state watcher that PokerActionPanel and
 * PlayerActionButtons each hand-rolled (ui#364 / ui#440). Three composable
 * signals, ANY one of which means the chain accepted our action:
 *
 *   - actionCount advanced        — chain, mid-hand (ui#364)
 *   - next-action index advanced  — gateway transport, where actionCount
 *                                    never moves (ui#440)
 *   - handNumber advanced         — hand-boundary actions, where actionCount
 *                                    resets so `>` never fires (ui#530-era fix)
 *
 * The controller uses this for two things: clearing busy once a submitted
 * action confirms, AND gating a transport-error retry (if the action already
 * landed despite the transport error, we must NOT re-broadcast — see
 * ActionSubmitController.runJob).
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { nextActionIndex } from "../hooks/playerActions/transportAction";
import { hasValue, isNullish } from "../utils/guards";
import type { ConfirmationBaseline } from "./types";

/** Capture the confirmation signals from a snapshot at execute time. */
export function snapshotConfirmationSignals(state: TexasHoldemStateDTO | undefined): ConfirmationBaseline {
    return {
        actionCount: state?.actionCount ?? 0,
        handNumber: state?.handNumber ?? 0,
        actionIndex: nextActionIndex(state)
    };
}

/**
 * True once `current` shows any confirmation signal advanced past `baseline`.
 *
 * Returns false when `current` is undefined (e.g. a WS reconnect briefly clears
 * the logical track) — the caller relies on the 8s timeout in that case rather
 * than confirming spuriously. actionCount/handNumber are monotonic across a
 * reconnect, so the baseline stays valid once state returns.
 */
export function confirmationAdvanced(baseline: ConfirmationBaseline, current: TexasHoldemStateDTO | undefined): boolean {
    if (isNullish(current)) {
        return false;
    }
    const countAdvanced = hasValue(current.actionCount) && current.actionCount > baseline.actionCount;
    const indexAdvanced = nextActionIndex(current) > baseline.actionIndex;
    const handAdvanced = hasValue(current.handNumber) && current.handNumber > baseline.handNumber;
    return countAdvanced || indexAdvanced || handAdvanced;
}
