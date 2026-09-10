/**
 * WS Action Bus — envelope and decoration types (Phase 1).
 *
 * Snapshot/action/format/variant types come from the SDK (Commandment 1). The
 * types declared here describe only the bus envelope and the decoration
 * pipeline. As of Phase 2 `events` carries the real transitions derived by
 * {@link deriveEvents}; `Decoration`/decorators/pacing remain declared-only
 * (`decoration` is still the inert default) until Phase 3.
 */
import type { TexasHoldemStateDTO, ActionDTO, WinnerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { ClassifiedMessage } from "./ingest";

/**
 * Typed transitions derived by diffing prev/next snapshot at ingest
 * ({@link deriveEvents}, Phase 2). One frame can carry several events.
 */
export type GameEvent =
    | { type: "handStarted"; handNumber: number }
    | { type: "playerActed"; action: ActionDTO }
    | { type: "roundAdvanced"; from: TexasHoldemRound; to: TexasHoldemRound; newCommunityCards: string[] }
    | { type: "handEnded"; winners: WinnerDTO[] }
    | { type: "playerJoined"; seat: number; address: string }
    | { type: "playerLeft"; seat: number; address: string }
    | { type: "stackChanged"; seat: number; from: string; to: string }
    | { type: "cardsRevealed"; seat: number; cards: string[] };

/** Every discriminant of {@link GameEvent}, for the typed `useGameEvents` filter. */
export type GameEventType = GameEvent["type"];

/**
 * Animation annotation a decorator may attach (Phase 3). `kind` names the
 * animation the render layer should run; the optional fields carry just enough
 * context for the consuming hook (e.g. which community cards were dealt, or which
 * seat acted) so it never re-derives that from a snapshot diff.
 */
export interface AnimationHint {
    kind: string;
    /** Per-item stagger between sub-elements (e.g. flop cards), ms. */
    staggerMs?: number;
    /** Community cards newly dealt this commit (for the `dealCards` hint). */
    cards?: string[];
    /** The street this animation belongs to (for the `dealCards` hint). */
    round?: string;
    /** The seat this animation belongs to (for the `actionBadge` hint). */
    seat?: number;

    // ---- Animation-ack contract (Phase 5, §2.7) --------------------------------
    //
    // A hint gates the drain's post-commit wait by opting into an ACK. The
    // contract is split so the two roles can never be confused:
    //
    //   - `ackTimeoutMs` is the OPT-IN, set BY THE DECORATOR. It is REQUIRED to
    //     opt in (Commandment 7 — no default): the decorator that wants the drain
    //     to wait for its animation must declare how long that animation may take.
    //     When it fires, the bus treats the animation as done regardless (a
    //     missing/late ack can never stall the stream).
    //   - `ackId` is assigned BY THE BUS at ingest (derived `${seq}:${hintIndex}`),
    //     NEVER by a decorator. It is present only on hints that opted in. The
    //     render consumer calls `bus.ackAnimation(ackId)` when its choreography
    //     finishes; the drain then commits the next item as soon as every
    //     ack-bearing hint of the current item has resolved (via ack OR timeout),
    //     bounded below by `minDisplayMs`.
    /** Assigned by the bus (`${seq}:${hintIndex}`) on opted-in hints. Never set by decorators. */
    ackId?: string;
    /** Decorator opt-in: max time this animation may take before the drain proceeds anyway. */
    ackTimeoutMs?: number;
}

/**
 * Sound annotation a decorator may attach (Phase 3). `kind` is the RESOLVED sound
 * key (see actionSoundUtils.getActionSoundKey — e.g. "check"/"call"/"raise"), so
 * the consumer calls `playActionSound(hint.kind)` with no further mapping.
 */
export interface SoundHint {
    kind: string;
    seat?: number;
}

/**
 * What decorators may attach to an item (Phase 3). All optional; the inert
 * default ({@link DEFAULT_DECORATION}) commits immediately with no pacing.
 *
 * Pacing fields (`holdPreviousMs`, `minDisplayMs`) are honored by the bus drain;
 * `animations`/`sounds` are hints for the render layer; `coalescible` grants the
 * drain permission to drop this item under backpressure (§2.6). See the
 * DECORATION-MERGE RULE on {@link Decorator} for how decorator outputs combine.
 */
export interface Decoration {
    minDisplayMs?: number;
    holdPreviousMs?: number;
    animations: AnimationHint[];
    sounds: SoundHint[];
    coalescible: boolean;
}

/** Inert decoration — commit immediately, no animations/sounds, not coalescible. */
export const DEFAULT_DECORATION: Decoration = {
    animations: [],
    sounds: [],
    coalescible: false
};

/**
 * Pure decorator function (Phase 3). Given a freshly-derived stream item and the
 * previous ingested snapshot, it returns a PARTIAL decoration to merge in. It
 * must not mutate its inputs.
 *
 * DECORATION-MERGE RULE (applied by GameMessageBus.applyDecorators, in
 * registration order): each decorator's patch is folded into the item's
 * accumulating decoration by:
 *   - `minDisplayMs` / `holdPreviousMs` → MAX of the existing and patch values
 *     (the longest hold any decorator asks for wins; absent = 0);
 *   - `animations` / `sounds` → CONCATENATED (every decorator's hints are kept);
 *   - `coalescible` → logical OR (any decorator marking it coalescible wins).
 * The order of registration therefore never changes the result — merge is
 * commutative — so decorators stay independent and unit-testable in isolation.
 */
export type Decorator = (item: GameStreamItem, prev: TexasHoldemStateDTO | undefined) => Partial<Decoration>;

/**
 * Monotonic envelope around every inbound WS message that the bus commits.
 * `classified` is the discriminated ingest result the provider maps onto React
 * state; `kind` mirrors it for cheap introspection.
 */
export interface GameStreamItem {
    /** Assigned at ingest, strictly monotonic, never reused across resets. */
    seq: number;
    /** performance.now() (or injected clock) at ingest. */
    receivedAt: number;
    kind: ClassifiedMessage["kind"];
    classified: ClassifiedMessage;
    /** Derived transitions for this commit (empty for non-state items). */
    events: GameEvent[];
    /** Accumulated decorations — always the inert default in Phase 1. */
    decoration: Decoration;
    /** Original parsed message, for error surfaces / debugging. */
    raw: unknown;
    /**
     * True for a frame SYNTHESIZED by {@link expandFrames} (one street of a
     * collapsed all-in runout), false for one that actually arrived on the wire.
     *
     * The drain excludes synthetic frames from its backpressure depth count:
     * they are planned choreography enqueued all at once, not backlog, and
     * counting them would trip DEPTH_CAP mid-runout — which suppresses the
     * animation acks (`afterCommit`) and abandons the very card reveal the
     * expansion exists to pace. They stay `coalescible`, so a genuinely lagging
     * client still drops them and snaps to truth.
     */
    synthetic: boolean;
}

/** Dev-only introspection snapshot exposed on window.__B52_BUS__ (§5.4). */
export interface BusIntrospection {
    lastSeq: number;
    ingested: number;
    committed: number;
    coalesced: number;
    /** Frames synthesized by expandFrames (runout streets), cumulative. */
    expanded: number;
    queueDepth: number;
    /** Number of derived events on the most recently committed item. */
    lastEventCount: number;
    /** Running total of derived events across all commits. */
    totalEvents: number;
    /** Ack-bearing hints currently awaiting `ackAnimation()`/timeout (Phase 5). */
    pendingAcks: number;
    /** Cumulative count of acks that fell back to their `ackTimeoutMs` (Phase 5). */
    ackTimeouts: number;
    commitLog: Array<{ seq: number; committedAt: number; eventCount: number }>;
}

declare global {
    interface Window {
        __B52_BUS__?: BusIntrospection;
    }
}
