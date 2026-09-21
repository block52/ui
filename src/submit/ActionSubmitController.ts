/**
 * ActionSubmitController — serialized, retrying outbound submission queue.
 *
 * The OUTBOUND twin of GameMessageBus (src/bus/): plain TypeScript, no React
 * imports, fully unit-testable with DI + fake timers. It exists to kill the
 * "click twice / silent fail" bug (ui#538) and the "confirmed by somebody
 * else's action" bug (ui#609) by owning four things:
 *
 *   1. Serialization + dedupe — one submission in flight at a time; a rapid
 *      double-click of the same action collapses to one broadcast.
 *   2. Safe retry — a transport error (dead RPC socket) is retried ONCE, but
 *      only after the evidence check proves our action did not already land.
 *      Stale-index and terminal errors are never retried; both surface.
 *   3. A single busy-state — `loadingAction` (the in-flight action's label).
 *   4. Honest confirmation (ui#609) — a job is confirmed only by IDENTITY: the
 *      chain recorded OUR action (our address, the recorded name our label maps
 *      to, at/after the baseline index), or the tx-by-hash query says our tx
 *      executed. A mempool projection moves a job to `accepted` (busy releases,
 *      but it is not a confirmation); the confirm timer expiring produces
 *      `unknown` and TELLS the user; a rejection found later — by the tx query,
 *      or because the chain recorded a different action of ours at our turn —
 *      is surfaced even after busy has released. Nothing here ever reports
 *      success it has no evidence for.
 *
 * Busy releases at `accepted` or `committed`, never on the SDK sync return
 * (the ui#364 invariant), so a submission never acts on a stale index.
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { PlayerActionResult } from "../types";
import { snapshotConfirmationSignals } from "./confirmationGate";
import { attributeEvidence, type Evidence, type OpenJobRef } from "./identity";
import { classifyActionError } from "./classifyActionError";
import type {
    ControllerSnapshot,
    SubmitActionRequest,
    SubmitControllerConfig,
    SubmitError,
    SubmitJob,
    SubmitNotice,
    TrackMeta,
    TxVerdict
} from "./types";

/** At most one distinct action waits behind the in-flight one. */
const QUEUE_CAP = 1;

/** Actions that legitimately form a queued next-step chain across state changes. */
const PROGRESSION_ACTIONS = new Set(["new-hand", "small-blind", "big-blind", "deal"]);

/**
 * Jobs that released busy but have no final verdict are kept for late evidence
 * (a rejection surfaced after `unknown`, a commit after `accepted`). Bounded so
 * a relay that never sends authoritative frames cannot grow it without limit.
 */
const SETTLING_CAP = 8;

export const DEFAULT_SUBMIT_CONFIG: SubmitControllerConfig = {
    dedupeWindowMs: 350,
    confirmTimeoutMs: 8000,
    maxTransportRetries: 1,
    backoffMs: 400,
    // The relay's mempool projection lands ~300–500 ms after broadcast; wait for
    // it before deciding a transport-errored broadcast did not land.
    gateSettleMs: 750,
    verdictPollMs: 2000,
    verdictTimeoutMs: 60_000
};

export interface ActionSubmitControllerOptions {
    /** Reads the logical track (immediate-at-ingest snapshot). */
    getState: () => TexasHoldemStateDTO | undefined;
    /** Our cosmos address — the identity a recorded action is matched against. */
    getLocalAddress: () => string | null;
    /** Surfaces a failure to the user (default provider wiring: toast.error). */
    onError: (error: SubmitError) => void;
    /** Surfaces a non-failure the user must know about, e.g. `unknown` (toast.warn). */
    onNotice?: (notice: SubmitNotice) => void;
    /** Drops the memoized signing client so a transport retry rebuilds it. */
    clearSigningCache: () => void;
    /**
     * Is the game-state socket live? When it is not, a submission is refused
     * before broadcast (kind `offline`): the state it was decided on may be
     * stale, and the chain's action clock keeps running regardless (ui#613).
     * Optional: without it nothing is gated.
     */
    isConnected?: () => boolean;
    /**
     * Asks the chain for a broadcast tx's execution result. `null` = no verdict
     * yet (not in a block, or the query failed). Optional: without it, evidence
     * comes from the WS snapshots only.
     */
    lookupTx?: (hash: string) => Promise<TxVerdict | null>;
    /** Clock; defaults to Date.now. Injectable for deterministic tests. */
    now?: () => number;
    config?: Partial<SubmitControllerConfig>;
}

type SnapshotListener = (snapshot: ControllerSnapshot) => void;

export class ActionSubmitController {
    private readonly getState: () => TexasHoldemStateDTO | undefined;
    private readonly getLocalAddress: () => string | null;
    private readonly onError: (error: SubmitError) => void;
    private readonly onNotice: (notice: SubmitNotice) => void;
    private readonly clearSigningCache: () => void;
    private readonly isConnected: (() => boolean) | null;
    private readonly lookupTx: ((hash: string) => Promise<TxVerdict | null>) | null;
    private readonly now: () => number;
    private readonly config: SubmitControllerConfig;

    private nextId = 1;
    private activeJob: SubmitJob | null = null;
    private queue: SubmitJob[] = [];
    /** Jobs that released busy (`accepted` / `unknown`) but have no final verdict yet. */
    private settling: SubmitJob[] = [];
    private lastError: SubmitError | null = null;
    /** Provenance of the last logical-track snapshot (for the transport-retry gate). */
    private lastMeta: TrackMeta = { optimistic: false };

    /** now() of the last terminal state per dedupe key, for the dedupe window. */
    private readonly lastSettledAt = new Map<string, number>();

    /** The active job's confirm timer, or null. */
    private confirmTimer: ReturnType<typeof setTimeout> | null = null;
    /** Per-job verdict polling timers. */
    private readonly verdictTimers = new Map<number, ReturnType<typeof setTimeout>>();

    private readonly listeners = new Set<SnapshotListener>();

    constructor(options: ActionSubmitControllerOptions) {
        this.getState = options.getState;
        this.getLocalAddress = options.getLocalAddress;
        this.onError = options.onError;
        this.onNotice = options.onNotice ?? (() => {});
        this.clearSigningCache = options.clearSigningCache;
        this.isConnected = options.isConnected ?? null;
        this.lookupTx = options.lookupTx ?? null;
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
        // Freshness gate (ui#613): never broadcast an action decided on a view
        // that may be stale. Surfaced like any failure; nothing is queued.
        if (this.isConnected && !this.isConnected()) {
            const error: SubmitError = {
                kind: "offline",
                message: `Not connected to the table — your ${request.actionName} was not sent. It will be possible again once the connection is back.`,
                actionName: request.actionName
            };
            this.lastError = error;
            this.onError(error);
            this.emit();
            return;
        }

        // Default dedupe key is position-aware: `${actionName}:${actionIndex}`.
        // A double-click fires at the SAME game position → same key → collapsed.
        // The same action a street later fires at a NEW index → different key →
        // never wrongly dropped by the settle window. Callers may override.
        const queuedBaseline = snapshotConfirmationSignals(this.getState());
        const baseIndex = queuedBaseline.actionIndex;
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
            submittedAt: at,
            queuedBaseline
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
     * Feed the logical track. Call on every snapshot update, with its
     * provenance. Evidence is attributed across the active job AND every
     * settling job, so a late confirmation or a supersession reaches a job
     * that already released busy.
     */
    public onGameState(snapshot: TexasHoldemStateDTO | undefined, meta: TrackMeta): void {
        this.lastMeta = meta;
        if (!snapshot) {
            return;
        }
        this.applyEvidence(snapshot, meta);
    }

    /** Abandon the active job, the queue and every settling job; cancel all timers. */
    public reset(): void {
        this.clearConfirmTimer();
        for (const timer of this.verdictTimers.values()) {
            clearTimeout(timer);
        }
        this.verdictTimers.clear();
        this.activeJob = null;
        this.queue = [];
        this.settling = [];
        this.emit();
    }

    // ---- evidence ------------------------------------------------------------

    private openJobs(): SubmitJob[] {
        const open: SubmitJob[] = [];
        if (this.activeJob && this.activeJob.baseline) {
            open.push(this.activeJob);
        }
        open.push(...this.settling);
        return open.filter(job => !this.isFinal(job));
    }

    private applyEvidence(snapshot: TexasHoldemStateDTO, meta: TrackMeta): void {
        const open = this.openJobs();
        if (open.length === 0) {
            return;
        }
        const refs: OpenJobRef[] = open.map(job => ({ id: job.id, actionName: job.request.actionName, baseline: job.baseline! }));
        const evidence = attributeEvidence(refs, this.getLocalAddress(), snapshot);
        for (const job of open) {
            this.applyJobEvidence(job, evidence.get(job.id) ?? { kind: "none" }, meta);
        }
    }

    private applyJobEvidence(job: SubmitJob, evidence: Evidence, meta: TrackMeta): void {
        switch (evidence.kind) {
            case "matched":
            case "handAdvanced":
                if (meta.optimistic) {
                    this.acceptJob(job);
                } else {
                    this.commitJob(job);
                }
                return;
            case "superseded":
                // A projection can still be reordered or dropped; only the
                // committed record proves the chain did something else instead.
                if (!meta.optimistic) {
                    this.failJob(job, {
                        kind: "superseded",
                        message: `Your ${job.request.actionName} did not land — the table recorded "${evidence.action.action}" for you instead.`,
                        actionName: job.request.actionName,
                        hash: job.hash
                    });
                }
                return;
            case "none":
                return;
        }
    }

    // ---- job lifecycle -------------------------------------------------------

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
        // Start the escape-hatch timer AND begin watching for evidence at
        // execute time: evidence (onGameState) can land before run() resolves,
        // and it must release busy either way.
        this.startConfirmTimer(job);

        for (let attempt = 0; attempt <= this.config.maxTransportRetries; attempt++) {
            if (this.hasEvidence(job) || this.isFinal(job)) {
                return; // evidence arrived between attempts
            }
            job.status = "submitting";
            this.emit();

            try {
                const result: PlayerActionResult = await job.request.run();
                job.hash = result.hash;
                job.broadcastAt = this.now();
                job.request.onSuccess?.(result.hash);
                if (!this.hasEvidence(job) && !this.isFinal(job) && !this.isUnknown(job)) {
                    job.status = "submitted";
                }
                this.startVerdictPolling(job);
                this.emit();
                return; // evidence, the verdict, or the confirm timer finishes it
            } catch (err) {
                if (this.hasEvidence(job) || this.isFinal(job)) {
                    return; // it landed / was decided while in flight — this error is moot
                }
                const kind = classifyActionError(err);
                const message = err instanceof Error ? err.message : String(err ?? "");

                if (kind === "stale") {
                    this.failJob(job, { kind, message, actionName: job.request.actionName });
                    return;
                }

                if (kind === "transport" && attempt < this.config.maxTransportRetries) {
                    // The broadcast may have gone out before the socket died — let
                    // the relay's projection land, then look for OUR action before
                    // re-broadcasting. (A transport error hides the hash, so the
                    // tx query cannot help here; the residual window is the
                    // projection latency. Closed properly by sign-once + identical
                    // rebroadcast in the SDK — ui#609 phase 2.)
                    await this.delay(this.config.gateSettleMs);
                    if (this.hasEvidence(job) || this.isFinal(job)) {
                        return;
                    }
                    const evidence = attributeEvidence(
                        [{ id: job.id, actionName: job.request.actionName, baseline: job.baseline }],
                        this.getLocalAddress(),
                        this.getState()
                    ).get(job.id);
                    if (evidence && (evidence.kind === "matched" || evidence.kind === "handAdvanced")) {
                        this.applyJobEvidence(job, evidence, this.lastMeta); // it landed — do NOT re-broadcast
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

    /** `accepted` or `committed`: the chain (or its projection) shows our action. */
    private hasEvidence(job: SubmitJob): boolean {
        return job.status === "accepted" || job.status === "committed";
    }

    /** Read through a method: control-flow narrowing must not assume the status is unchanged across an await. */
    private isUnknown(job: SubmitJob): boolean {
        return job.status === "unknown";
    }

    private isFinal(job: SubmitJob): boolean {
        return job.status === "committed" || job.status === "failed" || job.status === "deduped";
    }

    private startConfirmTimer(job: SubmitJob): void {
        this.clearConfirmTimer();
        this.confirmTimer = setTimeout(() => {
            this.confirmTimer = null;
            this.expireUnknown(job);
        }, this.config.confirmTimeoutMs);
    }

    private clearConfirmTimer(): void {
        if (this.confirmTimer !== null) {
            clearTimeout(this.confirmTimer);
            this.confirmTimer = null;
        }
    }

    /**
     * The escape hatch: no evidence either way when the timer fired. Busy
     * releases so the user is not stuck, the user is TOLD, and the job stays
     * open for a late verdict — it is never called confirmed.
     */
    private expireUnknown(job: SubmitJob): void {
        if (this.hasEvidence(job) || this.isFinal(job)) {
            return;
        }
        job.status = "unknown";
        console.warn(`[submit] no evidence within ${this.config.confirmTimeoutMs}ms for "${job.request.actionName}"; releasing busy as unknown.`);
        this.onNotice({
            kind: "unknown",
            message: `Couldn't confirm your ${job.request.actionName} yet — check the table before acting again.`,
            actionName: job.request.actionName,
            hash: job.hash
        });
        this.releaseBusy(job);
    }

    /** Our action is in the relay's projection: release busy, keep the job open for the verdict. */
    private acceptJob(job: SubmitJob): void {
        if (this.hasEvidence(job) || this.isFinal(job)) {
            return;
        }
        job.status = "accepted";
        this.releaseBusy(job);
    }

    /** Our action is committed (authoritative snapshot or tx query code 0): final. */
    private commitJob(job: SubmitJob): void {
        if (this.isFinal(job)) {
            return;
        }
        job.status = "committed";
        this.finalize(job);
    }

    private failJob(job: SubmitJob, error: SubmitError): void {
        if (this.isFinal(job)) {
            return;
        }
        job.status = "failed";
        job.error = error;
        this.lastError = error;
        this.onError(error);
        this.finalize(job);
    }

    /**
     * Busy releases (the next queued job starts) but the job is NOT done: it
     * moves to `settling` and keeps receiving evidence and verdict polls.
     */
    private releaseBusy(job: SubmitJob): void {
        if (this.activeJob?.id === job.id) {
            this.clearConfirmTimer();
            this.activeJob = null;
            if (!this.settling.includes(job)) {
                this.settling.push(job);
                while (this.settling.length > SETTLING_CAP) {
                    const dropped = this.settling.shift()!;
                    this.stopVerdictPolling(dropped);
                }
            }
        }
        this.lastSettledAt.set(job.dedupeKey, this.now());
        this.startNext();
    }

    /** A final state: timers stop, the job leaves every list. */
    private finalize(job: SubmitJob): void {
        this.stopVerdictPolling(job);
        this.settling = this.settling.filter(settling => settling.id !== job.id);
        if (this.activeJob?.id === job.id) {
            this.clearConfirmTimer();
            this.activeJob = null;
        }
        this.lastSettledAt.set(job.dedupeKey, this.now());
        this.startNext();
    }

    private startNext(): void {
        if (this.activeJob) {
            this.emit();
            return;
        }
        while (this.queue.length > 0) {
            const next = this.queue.shift()!;
            if (this.isStaleQueuedDecision(next)) {
                this.rejectStaleQueuedDecision(next);
                continue;
            }
            this.startJob(next);
            return;
        }
        this.emit();
    }

    /**
     * A queued player decision was made against an older turn. Progression
     * actions are intentionally exempt: new-hand → blind → deal is a valid
     * chain even though its action index and hand number advance.
     */
    private isStaleQueuedDecision(job: SubmitJob): boolean {
        if (PROGRESSION_ACTIONS.has(job.request.actionName)) {
            return false;
        }
        const state = this.getState();
        const localAddress = this.getLocalAddress();
        if (!state || !localAddress) {
            return false;
        }
        if (state.handNumber !== job.queuedBaseline.handNumber) {
            return true;
        }
        return state.previousActions.some(action => action.playerId === localAddress && action.index >= job.queuedBaseline.actionIndex);
    }

    private rejectStaleQueuedDecision(job: SubmitJob): void {
        const error: SubmitError = {
            kind: "superseded",
            message: `Your ${job.request.actionName} was not sent — the table moved on before it could run.`,
            actionName: job.request.actionName
        };
        job.status = "failed";
        job.error = error;
        this.lastError = error;
        this.lastSettledAt.set(job.dedupeKey, this.now());
        this.onError(error);
    }

    // ---- tx-by-hash verdict ---------------------------------------------------

    /**
     * Once we hold a hash, ask the chain for the tx's execution result until
     * the job is final or the verdict window closes. This is the only layer
     * that can say "your action FAILED": the relay pushes nothing for a tx that
     * executed and failed, and the SDK's sync broadcast returns before execution.
     */
    private startVerdictPolling(job: SubmitJob): void {
        if (!this.lookupTx || !job.hash || this.verdictTimers.has(job.id)) {
            return;
        }
        this.scheduleVerdictPoll(job);
    }

    private scheduleVerdictPoll(job: SubmitJob): void {
        const timer = setTimeout(() => {
            this.verdictTimers.delete(job.id);
            void this.pollVerdict(job);
        }, this.config.verdictPollMs);
        this.verdictTimers.set(job.id, timer);
    }

    private async pollVerdict(job: SubmitJob): Promise<void> {
        if (this.isFinal(job) || !this.lookupTx || !job.hash) {
            return;
        }
        let verdict: TxVerdict | null = null;
        try {
            verdict = await this.lookupTx(job.hash);
        } catch (err) {
            console.error(`[submit] tx lookup failed for ${job.hash}:`, err);
        }
        if (this.isFinal(job)) {
            return;
        }
        if (verdict) {
            job.verdict = verdict;
            if (verdict.code === 0) {
                this.commitJob(job);
            } else {
                this.failJob(job, {
                    kind: "rejected",
                    message: `Your ${job.request.actionName} was rejected by the chain: ${verdict.rawLog || `code ${verdict.code}`}`,
                    actionName: job.request.actionName,
                    hash: job.hash
                });
            }
            return;
        }
        const elapsed = this.now() - (job.broadcastAt ?? this.now());
        if (elapsed >= this.config.verdictTimeoutMs) {
            // No verdict in the window: the job stays whatever it is (`unknown`
            // or `accepted`) and stops occupying the settling list.
            this.settling = this.settling.filter(settling => settling.id !== job.id);
            return;
        }
        this.scheduleVerdictPoll(job);
    }

    private stopVerdictPolling(job: SubmitJob): void {
        const timer = this.verdictTimers.get(job.id);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.verdictTimers.delete(job.id);
        }
    }

    // ---- misc ----------------------------------------------------------------

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
