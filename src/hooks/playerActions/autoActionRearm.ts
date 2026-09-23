/**
 * When an automatic action may try again (ui#655, ui#661).
 *
 * Every auto hook holds a once-per-opportunity latch, and until now that latch
 * survived a FAILED submission — it was only cleared when the legal action
 * disappeared. So on 21 Sept a rejected auto-post left "Post Small Blind 25"
 * on screen with a pot of 0 and no way forward but a manual click or a page
 * refresh, hand after hand.
 *
 * Re-arming is not "retry until it works". It is: one controlled second look,
 * and only when the failure says the action did NOT take effect and the
 * opportunity may still be ours. The hook re-runs its own gate afterwards, so
 * the current hand, turn and legal action are all revalidated before anything
 * is submitted again, and the ActionSubmitController's dedupe window collapses
 * a manual click racing the retry.
 */
import type { SubmitError } from "../../submit/types";

/**
 * Re-arms allowed per opportunity. One. Two identical attempts that both fail
 * are evidence to stop and show the player the manual control, not grounds for
 * a third — an automatic action that can loop is worse than one that stalls.
 */
export const MAX_AUTO_REARMS = 1;

/**
 * Whether this failure earns the opportunity a second attempt.
 *
 * | kind         | re-arm | why |
 * |--------------|--------|-----|
 * | `transport`  | yes    | a dead socket or blip; the controller's own evidence gate already proved it did not land |
 * | `offline`    | yes    | refused before broadcast because the socket was not live — the reconnect is exactly when to look again |
 * | `terminal`   | yes    | a pre-broadcast rejection (the c1001 sequence mismatch); nothing was sent |
 * | `stale`      | no     | the engine rejected our action index — the table has moved on, and the next opportunity arms itself |
 * | `superseded` | no     | the chain recorded a different action of ours at this turn; ours can never land |
 * | `rejected`   | no     | it was broadcast and FAILED at execution. Distinguishing this from an unknown outcome is the point: a rejection is reported, not retried |
 */
export const shouldRearmAfterFailure = (error: SubmitError): boolean =>
    error.kind === "transport" || error.kind === "offline" || error.kind === "terminal";
