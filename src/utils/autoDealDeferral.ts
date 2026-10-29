/**
 * When may the automatic next-hand deal go out (ui#873)?
 *
 * The deal used to fire the instant the hand ended on the LOGICAL track, while
 * the rendered track was still showing the hand. For a tournament all-in that
 * meant the next hand's frames piled onto the run-out and the bus's
 * backpressure valve fast-forwarded it. Now the deal waits while the bus says a
 * protected run-out is still to be shown — but never longer than
 * {@link MAX_AUTO_DEAL_DEFER_MS}, so a stuck or throttled render (hidden tab,
 * lost ack, a bug) can never stop the table.
 *
 * Pure so the hook stays a thin timer around it.
 */
import { AUTO_DEAL_DEFER_POLL_MS, MAX_AUTO_DEAL_DEFER_MS } from "../bus/timing";

export type AutoDealDecision = { kind: "deal" } | { kind: "wait"; recheckInMs: number };

export interface AutoDealDeferralInput {
    /** The bus is still queuing or holding a protected run-out (bus.isPlayingSuspense()). */
    suspenseActive: boolean;
    /** How long this deal opportunity has already been deferred (ms, ≥ 0). */
    waitedMs: number;
    /** Hard cap on the deferral; defaults to {@link MAX_AUTO_DEAL_DEFER_MS}. */
    maxDeferMs?: number;
}

export function autoDealDecision({ suspenseActive, waitedMs, maxDeferMs = MAX_AUTO_DEAL_DEFER_MS }: AutoDealDeferralInput): AutoDealDecision {
    if (!suspenseActive || waitedMs >= maxDeferMs) {
        return { kind: "deal" };
    }
    // Re-check on the poll, but never past the cap.
    return { kind: "wait", recheckInMs: Math.max(0, Math.min(AUTO_DEAL_DEFER_POLL_MS, maxDeferMs - waitedMs)) };
}
