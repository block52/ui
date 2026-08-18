/**
 * ActionSubmitController — serialized, retrying outbound submission queue.
 *
 * The OUTBOUND twin of GameMessageBus (src/bus/): plain TypeScript, no React
 * imports, fully unit-testable with DI + fake timers. It exists to kill the
 * "click twice / silent fail" bug (ui#538) by owning three things that were
 * previously missing or scattered:
 *
 *   1. Serialization + dedupe — one submission in flight at a time; a rapid
 *      double-click of the same action collapses to one broadcast.
 *   2. Safe retry — a transport error (dead RPC socket) is retried ONCE, but
 *      only after the confirmation gate proves the action did not already land,
 *      so we never double-broadcast. Stale-index and terminal errors are never
 *      retried; both surface to the user.
 *   3. A single busy-state — `loadingAction` (the in-flight action's label),
 *      replacing the two hand-rolled dirty-state machines in PokerActionPanel
 *      and PlayerActionButtons.
 *
 * Confirmation (busy-clear) preserves the ui#364 invariant: a job does NOT
 * clear on the SDK sync return — only when a confirmation signal advances
 * (see confirmationGate) or the 8s escape-hatch timer fires.
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { PlayerActionResult } from "../types";
import { confirmationAdvanced, snapshotConfirmationSignals } from "./confirmationGate";
import { classifyActionError } from "./classifyActionError";
import type { ControllerSnapshot, SubmitActionRequest, SubmitControllerConfig, SubmitError, SubmitJob } from "./types";

/** At most one distinct action waits behind the in-flight one. */
const QUEUE_CAP = 1;

export const DEFAULT_SUBMIT_CONFIG: SubmitControllerConfig = {
    dedupeWindowMs: 350,
    confirmTimeoutMs: 8000,
    maxTransportRetries: 1,
    backoffMs: 400,
    gateSettleMs: 250
};

export interface ActionSubmitControllerOptions {
    /** Reads the logical track (immediate-at-ingest snapshot). */
    getState: () => TexasHoldemStateDTO | undefined;
    /** Surfaces a failure to the user (default provider wiring: toast.error). */
    onError: (error: SubmitError) => void;
    /** Drops the memoized signing client so a transport retry rebuilds it. */
    clearSigningCache: () => void;
    /** Clock; defaults to Date.now. Injectable for deterministic tests. */
    now?: () => number;
    config?: Partial<SubmitControllerConfig>;
}

type SnapshotListener = (snapshot: ControllerSnapshot) => void;

export class ActionSubmitController {
    private readonly getState: () => TexasHoldemStateDTO | undefined;
    private readonly onError: (error: SubmitError) => void;
    private readonly clearSigningCache: () => void;
    private readonly now: () => number;
    private readonly config: SubmitControllerConfig;

    private nextId = 1;
    private activeJob: SubmitJob | null = null;
    private queue: SubmitJob[] = [];
    private lastError: SubmitError | null = null;

    /** now() of the last terminal state per dedupe key, for the dedupe window. */
    private readonly lastSettledAt = new Map<string, number>();

    /** The active job's 8s confirm timer, or null. */
    private confirmTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly listeners = new Set<SnapshotListener>();

    constructor(options: ActionSubmitControllerOptions) {
        this.getState = options.getState;
        this.onError = options.onError;
        this.clearSigningCache = options.clearSigningCache;
        this.now = options.now ?? Date.now;
        this.config = { ...DEFAULT_SUBMIT_CONFIG, ...options.config };
    }

    /** Subscribe to snapshot changes. Returns an unsubscribe function. */
    public subscribe(listener: SnapshotListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getSnapshot(): ControllerSnapshot {
        return {
            status: this.activeJob ? "busy" : "idle",
            loadingAction: this.activeJob ? this.activeJob.request.actionName : null,
            queueDepth: this.queue.length,
            lastError: this.lastError
        };
    }

    /**
     * Enqueue a submission. Fire-and-forget: errors are surfaced via `onError`,
     * never thrown. Dropped submissions (dedupe / queue full) return silently.
     */
    public submit(request: SubmitActionRequest): void {
        // Default dedupe key is position-aware: `${actionName}:${actionIndex}`.
        // A double-click fires at the SAME game position → same key → collapsed.
        // The same action a street later fires at a NEW index → different key →
        // never wrongly dropped by the settle window. Callers may override.
        const baseIndex = snapshotConfirmationSignals(this.getState()).actionIndex;
        const dedupeKey = request.dedupeKey ?? `${request.actionName}:${baseIndex}`;
        const at = this.now();

        if (this.isDuplicate(dedupeKey, at)) {
            return;
        }

        const job: SubmitJob = {
            id: this.nextId++,
            request,
            dedupeKey,
            status: "queued",
            submittedAt: at
        };

        if (this.activeJob) {
            if (this.queue.length >= QUEUE_CAP) {
                console.warn(`[submit] queue full; dropping "${request.actionName}"`);
                return;
            }
            this.queue.push(job);
            this.emit();
            return;
        }

        this.startJob(job);
    }

    /**
     * Feed the logical track. Clears busy once a confirmation signal advances
     * past the active job's baseline. Call on every snapshot update.
     *
     * Note: this does NOT gate on the "confirming" status. The logical track
     * updates immediately at ingest, so a confirmation can arrive while the job
     * is still "submitting" (the broadcast in flight) — gating on "confirming"
     * would miss it and strand the spinner until the 8s timeout, blocking the
     * next action. `isTerminal` keeps it idempotent against a double-confirm.
     */
    public onGameState(snapshot: TexasHoldemStateDTO | undefined): void {
        const job = this.activeJob;
        if (job && job.baseline && !this.isTerminal(job) && confirmationAdvanced(job.baseline, snapshot)) {
            this.confirmJob(job);
        }
    }

    /** Abandon the active job + queue and cancel the confirm timer. */
    public reset(): void {
        this.clearConfirmTimer();
        this.activeJob = null;
        this.queue = [];
        this.emit();
    }

    // ---- internals ---------------------------------------------------------

    private isDuplicate(dedupeKey: string, at: number): boolean {
        const window = this.config.dedupeWindowMs;
        if (this.activeJob?.dedupeKey === dedupeKey) {
            return true; // already in flight
        }
        if (this.queue.some(j => j.dedupeKey === dedupeKey)) {
            return true; // already queued
        }
        const settledAt = this.lastSettledAt.get(dedupeKey);
        return settledAt !== undefined && at - settledAt < window;
    }

    private startJob(job: SubmitJob): void {
        this.activeJob = job;
        this.emit();
        // Fire and forget — runJob owns the job's lifecycle and never rejects.
        void this.runJob(job);
    }

    private async runJob(job: SubmitJob): Promise<void> {
        job.baseline = snapshotConfirmationSignals(this.getState());
        // Start the escape-hatch timer AND begin watching for confirmation at
        // submit time: a confirmation signal (onGameState) can land before
        // run() resolves, and it must clear busy either way.
        this.startConfirmTimer(job);

        for (let attempt = 0; attempt <= this.config.maxTransportRetries; attempt++) {
            if (this.isTerminal(job)) {
                return; // confirmed via onGameState between attempts
            }
            job.status = "submitting";
            this.emit();

            try {
                const result: PlayerActionResult = await job.request.run();
                job.hash = result.hash;
                job.request.onSuccess?.(result.hash);
                if (this.isTerminal(job)) {
                    return; // confirmed while the broadcast was in flight
                }
                job.status = "confirming";
                this.emit();
                return; // onGameState or the confirm timer finishes it
            } catch (err) {
                if (this.isTerminal(job)) {
                    return; // confirmed while in flight — this error is moot
                }
                const kind = classifyActionError(err);
                const message = err instanceof Error ? err.message : String(err ?? "");

                if (kind === "stale") {
                    this.failJob(job, { kind, message, actionName: job.request.actionName });
                    return;
                }

                if (kind === "transport" && attempt < this.config.maxTransportRetries) {
                    // The action may have landed despite the transport error —
                    // let one WS tick settle, then check before re-broadcasting.
                    await this.delay(this.config.gateSettleMs);
                    if (this.isTerminal(job)) {
                        return;
                    }
                    if (confirmationAdvanced(job.baseline, this.getState())) {
                        this.confirmJob(job); // it landed — do NOT re-broadcast
                        return;
                    }
                    this.clearSigningCache(); // stale RPC socket
                    await this.delay(this.config.backoffMs * (attempt + 1));
                    continue;
                }

                this.failJob(job, { kind, message, actionName: job.request.actionName });
                return;
            }
        }
    }

    private isTerminal(job: SubmitJob): boolean {
        return job.status === "confirmed" || job.status === "failed" || job.status === "deduped";
    }

    private startConfirmTimer(job: SubmitJob): void {
        this.clearConfirmTimer();
        this.confirmTimer = setTimeout(() => {
            this.confirmTimer = null;
            console.warn(
                `[submit] no confirmation within ${this.config.confirmTimeoutMs}ms for "${job.request.actionName}"; clearing busy.`
            );
            this.confirmJob(job);
        }, this.config.confirmTimeoutMs);
    }

    private clearConfirmTimer(): void {
        if (this.confirmTimer !== null) {
            clearTimeout(this.confirmTimer);
            this.confirmTimer = null;
        }
    }

    private confirmJob(job: SubmitJob): void {
        if (this.isTerminal(job)) {
            return; // already settled (e.g. onGameState + the run loop raced)
        }
        job.status = "confirmed";
        this.finalize(job);
    }

    private failJob(job: SubmitJob, error: SubmitError): void {
        if (this.isTerminal(job)) {
            return;
        }
        job.status = "failed";
        job.error = error;
        this.lastError = error;
        this.onError(error);
        this.finalize(job);
    }

    private finalize(job: SubmitJob): void {
        this.clearConfirmTimer();
        this.lastSettledAt.set(job.dedupeKey, this.now());
        if (this.activeJob?.id === job.id) {
            this.activeJob = null;
        }
        const next = this.queue.shift();
        if (next) {
            this.startJob(next);
            return;
        }
        this.emit();
    }

    private delay(ms: number): Promise<void> {
        if (ms <= 0) {
            return Promise.resolve();
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private emit(): void {
        const snapshot = this.getSnapshot();
        this.listeners.forEach(listener => listener(snapshot));
    }
}
