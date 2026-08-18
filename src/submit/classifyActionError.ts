/**
 * Classify a submission failure so the controller knows how to react:
 *
 *   - "stale"     — the engine rejected our action index (another player acted
 *                   between our snapshot and our submit). NEVER auto-retry; the
 *                   action was NOT applied, so we surface a "try again" prompt
 *                   and let the user re-submit against the advanced state.
 *   - "transport" — a dead RPC socket / network blip. Safe to retry ONCE, but
 *                   only after the confirmation gate proves the action didn't
 *                   already land (a transport error can arrive AFTER a
 *                   successful broadcast).
 *   - "terminal"  — anything else (insufficient funds, bad signature, wallet not
 *                   initialized, …). Surface it; do not retry.
 */
import { isStaleIndexError, STALE_INDEX_MESSAGE } from "../hooks/playerActions/transportAction";
import { isTransportError } from "../utils/cosmos/client";

export type ActionErrorKind = "stale" | "transport" | "terminal";

export function classifyActionError(err: unknown): ActionErrorKind {
    // executeTransportAction rewrites the raw "Invalid action index" into
    // STALE_INDEX_MESSAGE, so match both the rewritten copy and the raw form.
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (message === STALE_INDEX_MESSAGE || isStaleIndexError(err)) {
        return "stale";
    }
    if (isTransportError(err)) {
        return "transport";
    }
    return "terminal";
}
