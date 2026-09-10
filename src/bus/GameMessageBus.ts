/**
 * GameMessageBus — serialized, decoratable ingest queue between the WebSocket
 * and React (WS Action Bus, Phases 1–3).
 *
 * Plain TypeScript, no React imports, fully unit-testable. Responsibilities:
 *
 *   1. classify each raw message (via {@link classifyMessage});
 *   2. assign a strictly-monotonic `seq`;
 *   3. derive the typed transitions ({@link deriveEvents}) against the last
 *      INGESTED snapshot;
 *   4. run the registered decorators and merge their output into the item's
 *      {@link Decoration} (Phase 3);
 *   5. update the LOGICAL track immediately at ingest — `setLatestGameState`
 *      is fed the snapshot the instant it arrives, before any queueing, so
 *      action submission always reads a fresh action index (the plan's
 *      two-track invariant — pacing must NEVER delay this track);
 *   6. enqueue and drain STATE items one at a time (serialization guarantee),
 *      honoring each item's `holdPreviousMs` (delay before commit) then the
 *      post-commit wait `max(minDisplayMs, all ack-bearing hints resolved)`
 *      (Phase 3 + Phase 5);
 *   7. notify subscribers with the committed item (the RENDER track).
 *
 * Animation acks (Phase 5, §2.7):
 *   - A decorator opts a hint into gating the drain by setting `ackTimeoutMs` on
 *     it (required — no default). At ingest the bus stamps each opted-in hint with
 *     an `ackId` (`${seq}:${hintIndex}`).
 *   - After committing an item that carries ack-bearing hints, the drain does not
 *     schedule the next commit until every such hint has resolved — either the
 *     render layer called {@link ackAnimation} or the hint's `ackTimeoutMs` fired
 *     — AND `minDisplayMs` has elapsed (the two run concurrently: the wait is
 *     `max(minDisplayMs, ack resolution)`).
 *   - Invariants: every pending ack holds a live timeout; {@link reset} abandons
 *     all pending acks and their timers; backpressure (§2.6) abandons pending acks
 *     the same way it compresses holds; non-state kinds bypass acks entirely;
 *     unknown/duplicate/late `ackId`s are safe no-ops. Items WITHOUT ack-bearing
 *     hints keep the pre-Phase-5 single-timer-per-commit drain unchanged.
 *
 * Pacing (Phase 3):
 *   - Only `kind === "state"` items are paced and queued. All other kinds
 *     (`pending`, `actionAccepted`, `error`, `validationErrorNoState`) commit
 *     IMMEDIATELY and synchronously — they jump the queue AND any active hold
 *     (Commandment 7: errors surfaced immediately; optimistic pending shown at
 *     once). They carry no snapshot, so committing them out-of-band never
 *     disturbs the serialized STATE ordering.
 *   - The strict one-in-flight invariant holds: at most one drain timer is ever
 *     pending, and each timer commits exactly one state item before scheduling
 *     the next.
 *
 * Backpressure/coalescing (Phase 3, §2.6):
 *   - When the queued STATE depth exceeds {@link DEPTH_CAP} or the accumulated
 *     hold exceeds {@link HOLD_CAP_MS}, `coalescible` items are dropped, always
 *     keeping the NEWEST item and any hand-boundary (handEnded/handStarted)
 *     items — so the final state converges to the newest frame and every
 *     showdown is shown.
 *   - Under pressure, kept holds are shortened to {@link SHORTENED_HOLD_MS} so
 *     the queue can catch up.
 *
 * `reset()` clears the queue, cancels the in-flight hold timer, and clears the
 * last snapshot — but never rewinds `seq` (sequence numbers are never reused).
 */
import { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { classifyMessage, ClassifiedMessage, RawWsMessage } from "./ingest";
import { GameStreamItem, BusIntrospection, DEFAULT_DECORATION, Decoration, GameEvent, Decorator } from "./types";
import { deriveEvents } from "./deriveEvents";
import { expandFrames } from "./expandFrames";
import { buildDefaultDecorators } from "./decorators";
import { getCosmosAddressSync } from "../utils/cosmosAccountUtils";
import { isEmpty } from "../utils/guards";

/** Cap on the retained commit log so the dev handle never grows unbounded. */
const COMMIT_LOG_CAP = 200;

/** Queued STATE items above this trigger coalescing (§2.6). */
export const DEPTH_CAP = 5;

/** Accumulated queued hold (ms) above this triggers coalescing (§2.6). */
export const HOLD_CAP_MS = 4000;

/** Under pressure, an item's post-commit hold is clamped to this (§2.6). */
export const SHORTENED_HOLD_MS = 500;

type Listener = (item: GameStreamItem) => void;

export interface GameMessageBusOptions {
    /** Logical-track mirror — fed at INGEST time (setLatestGameState). */
    setLatestGameState: (state: TexasHoldemStateDTO | undefined) => void;
    /** Clock for `receivedAt` and commit timestamps; defaults to performance.now(). */
    now?: () => number;
    /** Decorators to run at ingest; defaults to {@link buildDefaultDecorators}. */
    decorators?: Decorator[];
    /** Local cosmos address accessor for remoteActionSound; defaults to localStorage. */
    getLocalAddress?: () => string | null;
}

export class GameMessageBus {
    private readonly setLatestGameState: (state: TexasHoldemStateDTO | undefined) => void;
    private readonly now: () => number;
    private readonly decorators: Decorator[];

    private seq = 0;
    private queue: GameStreamItem[] = [];
    private listeners = new Set<Listener>();

    /** True while a drain cycle owns the loop (a hold timer is pending). */
    private draining = false;
    /** The single pending hold/minDisplay timer, or null. */
    private drainTimer: ReturnType<typeof setTimeout> | null = null;
    /** minDisplay owed by the last committed item, applied before the next commit. */
    private carryDelayMs = 0;

    /**
     * Ack-bearing hints of the just-committed item still awaiting resolution
     * (Phase 5). Keyed by `ackId`; each entry owns a live timeout timer and a
     * `resolve` callback that advances the drain. Empty except during a
     * post-commit ack wait — at most one item's acks are ever pending at once
     * (one-in-flight drain).
     */
    private readonly pendingAcks = new Map<string, { timer: ReturnType<typeof setTimeout>; resolve: () => void }>();

    /** Last snapshot seen at ingest — retained for event derivation + decorators. */
    private lastSnapshot: TexasHoldemStateDTO | undefined = undefined;

    /** Live introspection object; the provider aliases window.__B52_BUS__ to it. */
    public readonly introspection: BusIntrospection = {
        lastSeq: 0,
        ingested: 0,
        committed: 0,
        coalesced: 0,
        expanded: 0,
        queueDepth: 0,
        lastEventCount: 0,
        totalEvents: 0,
        pendingAcks: 0,
        ackTimeouts: 0,
        commitLog: []
    };

    constructor(options: GameMessageBusOptions) {
        this.setLatestGameState = options.setLatestGameState;
        this.now = options.now ?? (() => performance.now());
        this.decorators = options.decorators ?? buildDefaultDecorators(options.getLocalAddress ?? getCosmosAddressSync);
    }

    /** Subscribe to committed items. Returns an unsubscribe function. */
    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Ingest a single parsed WS message for `tableId`. Updates the logical
     * track synchronously, then enqueues (state) or commits immediately (all
     * other kinds) for serialized commit.
     */
    public ingest(raw: RawWsMessage, tableId: string): void {
        const classified = classifyMessage(raw, tableId);

        // Ignored frames (acks, unknown types, wrong-table) never reach the queue.
        if (classified.kind === "ignore") {
            return;
        }

        // Snapshot the previous ingested state BEFORE the logical-track update
        // below overwrites it — decorators and derivation both diff against it.
        const prevSnapshot = this.lastSnapshot;

        // Logical track — the REAL snapshot, committed immediately and EXACTLY
        // ONCE, before any queueing/pacing/expansion. Synthetic frames must never
        // reach it: action submission reads this track, and a projected frame's
        // stale action indices would be rejected by the chain.
        this.updateLogicalTrack(classified);

        this.introspection.ingested += 1;

        // Non-state kinds carry no snapshot, so there is nothing to expand.
        if (classified.kind !== "state") {
            this.enqueue(this.buildItem(classified, prevSnapshot, raw, false));
            this.introspection.lastSeq = this.seq;
            return;
        }

        // One arriving snapshot may have collapsed several streets — the engine
        // runs an all-in runout inside a single performAction with no yield point.
        // Expanding it gives the drain the commit boundaries it needs to pace the
        // board, and to keep the winner from painting before the river.
        const frames = expandFrames(prevSnapshot, classified.snapshot);
        const finalIndex = frames.length - 1;

        let previous = prevSnapshot;
        for (let index = 0; index < frames.length; index++) {
            const isFinal = index === finalIndex;
            // Each sub-frame is derived and decorated against its PREDECESSOR, so
            // every decorator sees exactly one street's worth of change and needs
            // no knowledge of expansion.
            const frameClassified = isFinal ? classified : { ...classified, snapshot: frames[index] };
            this.enqueue(this.buildItem(frameClassified, previous, raw, !isFinal));
            if (!isFinal) {
                this.introspection.expanded += 1;
            }
            previous = frames[index];
        }

        this.introspection.lastSeq = this.seq;
    }

    /**
     * Build one fully-derived, decorated, ack-stamped stream item against `prev`.
     * Assigns the next `seq` — every sub-frame of an expansion gets its own,
     * because `ackId` is `${seq}:${hintIndex}` and must stay globally unique.
     */
    private buildItem(
        classified: ClassifiedMessage,
        prev: TexasHoldemStateDTO | undefined,
        raw: RawWsMessage,
        synthetic: boolean
    ): GameStreamItem {
        this.seq += 1;

        const item: GameStreamItem = {
            seq: this.seq,
            receivedAt: this.now(),
            kind: classified.kind,
            classified,
            events: this.deriveEventsForItem(classified, prev),
            decoration: { ...DEFAULT_DECORATION },
            raw,
            synthetic
        };

        // Run decorators to accumulate the item's decoration (Phase 3).
        this.applyDecorators(item, prev);

        // Stamp ack ids onto opted-in hints (Phase 5) — done by the bus, never by
        // decorators, so ids are globally unique (`${seq}:${hintIndex}`).
        this.assignAckIds(item);

        return item;
    }

    /**
     * Clear the queue and last snapshot, and cancel any in-flight hold timer
     * (on unsubscribe/resubscribe/replay). `seq` continues monotonically —
     * sequence numbers are never reused — and the commit log is retained so the
     * dev handle survives a resubscribe (seq continuity is observable there).
     */
    public reset(): void {
        this.queue = [];
        this.carryDelayMs = 0;
        if (this.drainTimer !== null) {
            clearTimeout(this.drainTimer);
            this.drainTimer = null;
        }
        // Abandon any in-flight ack wait: clear its timers and let its `resolve`
        // callbacks fire against the now-empty queue (a harmless no-op) — no
        // pending ack ever outlives a reset (Phase 5 invariant).
        this.abandonAcks();
        this.draining = false;
        this.lastSnapshot = undefined;
        this.introspection.queueDepth = 0;
    }

    /**
     * Resolve a pending animation ack (Phase 5). Called by the render layer when
     * an ack-bearing hint's choreography finishes. Cancels the hint's timeout and
     * lets the drain advance once every ack of the committed item has resolved.
     *
     * Unknown, duplicate, or late `ackId`s are safe no-ops — the id may have
     * already timed out, been abandoned by reset()/backpressure, or never existed.
     */
    public ackAnimation(ackId: string): void {
        const entry = this.pendingAcks.get(ackId);
        if (!entry) {
            return;
        }
        clearTimeout(entry.timer);
        this.pendingAcks.delete(ackId);
        this.introspection.pendingAcks = this.pendingAcks.size;
        entry.resolve();
    }

    /** The most recent snapshot seen at ingest (logical track view). */
    public getLastSnapshot(): TexasHoldemStateDTO | undefined {
        return this.lastSnapshot;
    }

    // ---- ingest helpers ----------------------------------------------------

    /**
     * Derive events for a classified item against the last ingested snapshot.
     * Only `state` items carry events. Regressed snapshots ({@link deriveEvents})
     * are surfaced via console.error and yield no events — the frame itself is
     * still committed (Commandment 7: surface, never drop).
     */
    private deriveEventsForItem(classified: ClassifiedMessage, prev: TexasHoldemStateDTO | undefined): GameEvent[] {
        if (classified.kind !== "state") {
            return [];
        }
        try {
            return deriveEvents(prev, classified.snapshot);
        } catch (err) {
            console.error("[GameMessageBus] event derivation failed:", (err as Error).message);
            return [];
        }
    }

    private applyDecorators(item: GameStreamItem, prev: TexasHoldemStateDTO | undefined): void {
        for (const decorator of this.decorators) {
            const patch = decorator(item, prev);
            item.decoration = mergeDecoration(item.decoration, patch);
        }
    }

    /**
     * Stamp an `ackId` onto every hint that opted in (set `ackTimeoutMs`). The id
     * is `${seq}:${hintIndex}` — globally unique because `seq` is monotonic and
     * never reused. Hint objects are freshly created by each decorator per ingest,
     * so mutating them here shares nothing across items (Phase 5).
     */
    private assignAckIds(item: GameStreamItem): void {
        item.decoration.animations.forEach((hint, index) => {
            if (hint.ackTimeoutMs !== undefined) {
                hint.ackId = `${item.seq}:${index}`;
            }
        });
    }

    private updateLogicalTrack(classified: ClassifiedMessage): void {
        if (classified.kind === "state") {
            this.lastSnapshot = classified.snapshot;
            this.setLatestGameState(classified.snapshot);
        } else if (classified.kind === "error" && classified.clearGameState) {
            this.lastSnapshot = undefined;
            this.setLatestGameState(undefined);
        }
    }

    // ---- queue + paced drain ----------------------------------------------

    private enqueue(item: GameStreamItem): void {
        // Non-state kinds are never paced: they carry no snapshot, so they jump
        // the queue AND any active hold, committing immediately (Commandment 7).
        if (item.kind !== "state") {
            this.commit(item);
            return;
        }
        this.queue.push(item);
        this.introspection.queueDepth = this.queue.length;
        // Backpressure abandons an in-flight ack wait the same way it compresses
        // holds (§2.6): if the newly-queued item pushes us over a cap while the
        // drain is gated on acks, stop waiting so the queue can catch up.
        if (this.pendingAcks.size > 0 && (this.backlogDepth() > DEPTH_CAP || this.accumulatedHoldMs() > HOLD_CAP_MS)) {
            this.abandonAcks();
        }
        this.scheduleDrain();
    }

    private scheduleDrain(): void {
        // A drain cycle already owns the loop; it will pick up newly-queued items.
        if (this.draining || isEmpty(this.queue)) {
            return;
        }
        this.draining = true;
        this.pump();
    }

    /**
     * Schedule committing the head item after its pre-commit delay, then recurse.
     * One timer pending at a time — the serialization guarantee. A 0ms delay
     * still goes through a timer boundary, so each `runOnlyPendingTimers()`
     * flushes exactly one commit.
     */
    private pump(): void {
        this.coalesce();

        if (isEmpty(this.queue)) {
            if (this.carryDelayMs > 0) {
                // The queue drained but the last commit still owes a minDisplay
                // hold (e.g. a showdown with nothing yet behind it). Wait it out
                // so a frame arriving during the window still honors the hold,
                // rather than committing early.
                const wait = this.carryDelayMs;
                this.carryDelayMs = 0;
                this.drainTimer = setTimeout(() => {
                    this.drainTimer = null;
                    this.pump();
                }, wait);
                return;
            }
            this.draining = false;
            return;
        }

        const head = this.queue[0];
        const underPressure = this.backlogDepth() > DEPTH_CAP || this.accumulatedHoldMs() > HOLD_CAP_MS;
        const holdPreviousMs = head.decoration.holdPreviousMs ?? 0;
        const preDelay = this.carryDelayMs + holdPreviousMs;
        this.carryDelayMs = 0;

        this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            const item = this.queue.shift();
            if (!item) {
                this.draining = false;
                return;
            }
            this.introspection.queueDepth = this.queue.length;
            this.commit(item);
            this.afterCommit(item, underPressure);
        }, preDelay);
    }

    /**
     * Post-commit wait (Phase 3 + Phase 5): the next commit is delayed by
     * `max(minDisplayMs, all ack-bearing hints resolved)`.
     *
     * Fast path — an item with NO ack-bearing hints folds `minDisplayMs` into the
     * next commit's pre-delay via `carryDelayMs` and recurses immediately, exactly
     * as the pre-Phase-5 drain did (one timer boundary per commit).
     *
     * Ack path — an item WITH ack-bearing hints starts the `minDisplayMs` timer
     * AND registers each ack (each with its own `ackTimeoutMs`); the next commit is
     * scheduled only once BOTH the min-display elapsed and every ack resolved. Under
     * backpressure, acks are abandoned (skipped) so the queue can catch up (§2.6).
     */
    private afterCommit(item: GameStreamItem, underPressure: boolean): void {
        let minDisplayMs = item.decoration.minDisplayMs ?? 0;
        if (underPressure && minDisplayMs > SHORTENED_HOLD_MS) {
            // Shorten holds (incl. handEnded) so the queue can catch up (§2.6).
            minDisplayMs = SHORTENED_HOLD_MS;
        }

        const ackHints = underPressure ? [] : item.decoration.animations.filter(h => h.ackId !== undefined);

        if (isEmpty(ackHints)) {
            this.carryDelayMs = minDisplayMs;
            this.pump();
            return;
        }

        // Ack path: gate the next commit on max(minDisplayMs, acks resolved).
        let minDone = minDisplayMs === 0;
        let remaining = ackHints.length;
        const advance = () => {
            if (minDone && remaining === 0) {
                this.carryDelayMs = 0;
                this.pump();
            }
        };
        if (!minDone) {
            this.drainTimer = setTimeout(() => {
                this.drainTimer = null;
                minDone = true;
                advance();
            }, minDisplayMs);
        }
        for (const hint of ackHints) {
            this.registerAck(hint.ackId!, hint.ackTimeoutMs!, () => {
                remaining -= 1;
                advance();
            });
        }
    }

    /**
     * Register a pending ack with a live timeout (Phase 5). The timeout firing
     * counts as an ack timeout (introspection) and resolves the wait — a missing
     * ack can never stall the drain. Duplicate ids (should not occur — seq is
     * unique) are ignored.
     */
    private registerAck(ackId: string, timeoutMs: number, onResolve: () => void): void {
        if (this.pendingAcks.has(ackId)) {
            return;
        }
        const timer = setTimeout(() => {
            this.pendingAcks.delete(ackId);
            this.introspection.pendingAcks = this.pendingAcks.size;
            this.introspection.ackTimeouts += 1;
            onResolve();
        }, timeoutMs);
        this.pendingAcks.set(ackId, { timer, resolve: onResolve });
        this.introspection.pendingAcks = this.pendingAcks.size;
    }

    /**
     * Abandon every pending ack (Phase 5): clear its timeout and fire its
     * `resolve` so any waiting drain advances immediately. Used by reset() and by
     * backpressure — abandoning is NOT a timeout, so it never bumps `ackTimeouts`.
     */
    private abandonAcks(): void {
        if (this.pendingAcks.size === 0) {
            return;
        }
        const entries = [...this.pendingAcks.values()];
        this.pendingAcks.clear();
        this.introspection.pendingAcks = 0;
        for (const { timer, resolve } of entries) {
            clearTimeout(timer);
            resolve();
        }
    }

    /**
     * Drop coalescible items when over the depth/hold cap, always keeping the
     * newest item and any hand-boundary item so the final state converges and no
     * showdown is missed (§2.6). Increments the `coalesced` introspection counter.
     */
    private coalesce(): void {
        const overDepth = this.backlogDepth() > DEPTH_CAP;
        const overHold = this.accumulatedHoldMs() > HOLD_CAP_MS;
        if (!overDepth && !overHold) {
            return;
        }
        const lastIndex = this.queue.length - 1;
        const kept: GameStreamItem[] = [];
        for (let i = 0; i < this.queue.length; i++) {
            const it = this.queue[i];
            const isNewest = i === lastIndex;
            const isHandBoundary = it.events.some(e => e.type === "handEnded" || e.type === "handStarted");
            if (it.decoration.coalescible && !isNewest && !isHandBoundary) {
                this.introspection.coalesced += 1;
            } else {
                kept.push(it);
            }
        }
        this.queue = kept;
        this.introspection.queueDepth = this.queue.length;
    }

    /**
     * Queue depth counting only frames that actually ARRIVED, ignoring the ones
     * expandFrames synthesized.
     *
     * A runout enqueues up to five sub-frames in a single ingest. Counting those
     * as backlog would trip DEPTH_CAP the moment one more real frame lands — and
     * the 250ms optimistic poller guarantees one will — which sets `underPressure`,
     * drops every animation ack in `afterCommit`, and collapses the runout to
     * nothing. Backlog is what the client has fallen BEHIND on; planned
     * choreography is not backlog (plan §2.6).
     */
    private backlogDepth(): number {
        let depth = 0;
        for (const item of this.queue) {
            if (!item.synthetic) {
                depth += 1;
            }
        }
        return depth;
    }

    private accumulatedHoldMs(): number {
        let sum = 0;
        for (const it of this.queue) {
            sum += (it.decoration.holdPreviousMs ?? 0) + (it.decoration.minDisplayMs ?? 0);
        }
        return sum;
    }

    private commit(item: GameStreamItem): void {
        this.introspection.committed += 1;
        this.introspection.lastEventCount = item.events.length;
        this.introspection.totalEvents += item.events.length;
        this.introspection.commitLog.push({ seq: item.seq, committedAt: this.now(), eventCount: item.events.length });
        if (this.introspection.commitLog.length > COMMIT_LOG_CAP) {
            this.introspection.commitLog.splice(0, this.introspection.commitLog.length - COMMIT_LOG_CAP);
        }
        this.listeners.forEach(listener => listener(item));
    }
}

/**
 * Fold a decorator's partial output into an accumulating decoration per the
 * DECORATION-MERGE RULE (see {@link Decorator}): max holds, concat hints, OR
 * coalescible. Pure — returns a new object, mutates neither argument.
 */
export function mergeDecoration(base: Decoration, patch: Partial<Decoration>): Decoration {
    const merged: Decoration = {
        minDisplayMs: maxHold(base.minDisplayMs, patch.minDisplayMs),
        holdPreviousMs: maxHold(base.holdPreviousMs, patch.holdPreviousMs),
        animations: patch.animations ? [...base.animations, ...patch.animations] : base.animations,
        sounds: patch.sounds ? [...base.sounds, ...patch.sounds] : base.sounds,
        coalescible: base.coalescible || (patch.coalescible ?? false)
    };
    // Keep the field absent (not 0) when neither side set it, so "no hold" reads
    // cleanly in introspection and the drain's `?? 0` still applies.
    if (merged.minDisplayMs === undefined) delete merged.minDisplayMs;
    if (merged.holdPreviousMs === undefined) delete merged.holdPreviousMs;
    return merged;
}

function maxHold(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return Math.max(a, b);
}
