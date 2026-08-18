/**
 * Types for the outbound action submission controller (src/submit/).
 *
 * This is the OUTBOUND twin of the inbound WS Action Bus (src/bus/): a
 * framework-free, serialized queue that sits between button clicks and the
 * chain. It dedupes double-clicks, runs one submission at a time, retries only
 * transport failures (and only when a confirmation check proves the action did
 * NOT already land), and surfaces every failure. See ui#538.
 */
import type { PlayerActionResult } from "../types";

/**
 * One submission request. `run` is a lazy, re-runnable thunk so the controller
 * stays transport-agnostic: fold/call/bet/deal/new-hand all look the same here,
 * and a retry simply re-invokes the thunk (which reads fresh state at call
 * time). The thunk MUST throw on failure — a resolved value is treated as a
 * successful broadcast.
 */
export interface SubmitActionRequest {
    /**
     * Display label + default dedupe key (e.g. "fold", "call", "bet", "raise",
     * "check", "deal", "new-hand", "small-blind", "big-blind", "muck", "show",
     * "sit-in", "sit-out"). This is the string button spinners key on.
     */
    actionName: string;
    /** The actual submission. Lazy + re-runnable (retry re-invokes it). */
    run: () => Promise<PlayerActionResult>;
    /**
     * Collapse key for double-click dedupe. Defaults to `actionName` — two rapid
     * identical clicks share a key and the second is dropped. Override when the
     * same label carries distinct intents that must not collapse.
     */
    dedupeKey?: string;
    /** Called once with the tx hash on a successful broadcast (before confirm). */
    onSuccess?: (hash: string) => void;
}

/**
 * Job lifecycle. `queued` → `submitting` → `confirming` → `confirmed`, with
 * `failed` and `deduped` as the other terminal states. `confirmed` covers both
 * a real confirmation-signal advance and the 8s timeout escape hatch (both
 * clear busy). Transient retry-gating lives inside the run loop and needs no
 * external status.
 */
export type JobStatus = "queued" | "submitting" | "confirming" | "confirmed" | "failed" | "deduped";

/** How a submission failed — drives the toast copy and whether we retried. */
export interface SubmitError {
    kind: "stale" | "transport" | "terminal";
    message: string;
    actionName: string;
}

/** A single tracked submission. */
export interface SubmitJob {
    id: number;
    request: SubmitActionRequest;
    dedupeKey: string;
    status: JobStatus;
    /** now() at enqueue — used for the dedupe window. */
    submittedAt: number;
    /** Confirmation signals captured at execute time (not enqueue). */
    baseline?: ConfirmationBaseline;
    hash?: string;
    error?: SubmitError;
}

/**
 * The confirmation signals we watch to know a submitted action landed. Captured
 * at execute time; ANY one advancing means "committed" (see confirmationGate).
 */
export interface ConfirmationBaseline {
    actionCount: number;
    handNumber: number;
    actionIndex: number;
}

/** What React consumers read to drive button state. */
export interface ControllerSnapshot {
    status: "idle" | "busy";
    /** The in-flight job's actionName, or null when idle. */
    loadingAction: string | null;
    queueDepth: number;
    lastError: SubmitError | null;
}

/** Tuning knobs (all required internally; the controller supplies defaults). */
export interface SubmitControllerConfig {
    /** A same-key submit within this window of an active/recent one is dropped. */
    dedupeWindowMs: number;
    /** Escape hatch: clear busy this long after broadcast if no confirmation. */
    confirmTimeoutMs: number;
    /** Max transport-error retries (NOT stale/terminal). */
    maxTransportRetries: number;
    /** Base backoff between transport retries (×(attempt+1)). */
    backoffMs: number;
    /** After a transport error, wait this long for a WS tick before the gate check. */
    gateSettleMs: number;
}
