/**
 * Types for the outbound action submission controller (src/submit/).
 *
 * This is the OUTBOUND twin of the inbound WS Action Bus (src/bus/): a
 * framework-free, serialized queue that sits between button clicks and the
 * chain. It dedupes double-clicks, runs one submission at a time, retries only
 * transport failures (and only when the evidence proves the action did NOT
 * already land), and surfaces every failure. See ui#538 and ui#609.
 */
import type { PlayerActionResult } from "../types";
import type { TrackMeta } from "../bus/types";

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
     * "sit-in", "sit-out"). This is the string button spinners key on, and the
     * key `recordedActionsFor` maps to the action name the chain records.
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
 * Job lifecycle (ui#609). Every state is a statement about EVIDENCE, never a
 * guess — in particular a timer expiring produces `unknown`, never a confirmation:
 *
 *   queued      waiting behind the in-flight job
 *   submitting  `run()` in flight (signing + broadcast)
 *   submitted   CheckTx accepted the broadcast (we hold a hash); no evidence of execution yet
 *   accepted    OUR action was seen in an OPTIMISTIC (mempool-projection) snapshot — busy
 *               releases here so the next action is not held for a block, but this is
 *               not a confirmation: a later chain rejection still surfaces
 *   committed   OUR action was seen in an AUTHORITATIVE snapshot, or the tx-by-hash query
 *               returned code 0 — final
 *   failed      rejected before broadcast, rejected at execution (tx query code ≠ 0), or
 *               superseded (the chain recorded a different action of ours at our turn) — final
 *   unknown     the confirm timer expired with no evidence either way — busy releases, the
 *               user is told, and the tx query keeps looking for a late verdict
 *               (unknown → committed | failed)
 *   deduped     collapsed into an identical in-flight/recent job
 */
export type JobStatus = "queued" | "submitting" | "submitted" | "accepted" | "committed" | "failed" | "unknown" | "deduped";

/** How a submission failed — drives the toast copy and whether we retried. */
export interface SubmitError {
    /**
     *   stale       the engine rejected our action index (never retried)
     *   transport   a dead socket / network blip (retried once, evidence-gated)
     *   terminal    any other pre-broadcast rejection
     *   rejected    broadcast, then FAILED at execution — from the tx-by-hash query
     *   superseded  the chain recorded a different action of ours at our turn (e.g. the
     *               action clock folded us before our call landed), so ours cannot land
     *   offline     refused before broadcast: the game-state socket is not live, so the
     *               view this action was decided on may be stale (ui#613)
     */
    kind: "stale" | "transport" | "terminal" | "rejected" | "superseded" | "offline";
    message: string;
    actionName: string;
    /** The broadcast tx, when there was one. */
    hash?: string;
}

/** Something that is not a failure but the user must still know about. */
export interface SubmitNotice {
    /** `unknown`: no evidence either way when the confirm timer expired. */
    kind: "unknown";
    message: string;
    actionName: string;
    hash?: string;
}

/** The chain's execution result for a broadcast tx (tx-by-hash query). */
export interface TxVerdict {
    hash: string;
    /** 0 = executed; anything else = failed at DeliverTx (see `rawLog`). */
    code: number;
    rawLog: string;
    height: number;
}

/** Provenance of a logical-track snapshot — defined with the bus, re-exported for consumers. */
export type { TrackMeta } from "../bus/types";

/** A single tracked submission. */
export interface SubmitJob {
    id: number;
    request: SubmitActionRequest;
    dedupeKey: string;
    status: JobStatus;
    /** now() at enqueue — used for the dedupe window. */
    submittedAt: number;
    /** Snapshot captured when the job entered the queue, before an active job could change the table. */
    queuedBaseline: ConfirmationBaseline;
    /** Confirmation baseline captured at execute time (not enqueue). */
    baseline?: ConfirmationBaseline;
    /** The broadcast tx hash, once CheckTx accepted it. */
    hash?: string;
    /** now() when the hash was obtained — bounds the verdict polling. */
    broadcastAt?: number;
    error?: SubmitError;
    verdict?: TxVerdict;
}

/**
 * Where we were when the job executed: our action must appear at an index at
 * or after `actionIndex`, and a `new-hand` must move `handNumber` past this.
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
    /** Escape hatch: release busy this long after execute if there is still NO evidence → `unknown`. */
    confirmTimeoutMs: number;
    /** Max transport-error retries (NOT stale/terminal). */
    maxTransportRetries: number;
    /** Base backoff between transport retries (×(attempt+1)). */
    backoffMs: number;
    /** After a transport error, wait this long for the relay's projection before the evidence check. */
    gateSettleMs: number;
    /** How often to ask the chain for the broadcast tx's execution result. */
    verdictPollMs: number;
    /** Stop asking after this long; a job with no evidence by then stays `unknown`. */
    verdictTimeoutMs: number;
}
