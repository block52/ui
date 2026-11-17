/**
 * Animation-ack drain tests (WS Action Bus, Phase 5, §2.7).
 *
 * Fake-timer tests of the ack-gated post-commit wait. Ack-bearing hints are
 * injected with a custom decorator (like pacing.test.ts) so these tests pin the
 * ack machinery itself, independent of deriveEvents/communityCardStagger.
 *
 * Invariants covered: the next commit waits max(minDisplayMs, acks resolved);
 * ack-early / ack-late / no-ack (timeout) all release correctly; multiple acks on
 * one item all gate; reset() and backpressure abandon pending acks (never a
 * timeout); duplicate/unknown ackIds are no-ops; non-state kinds bypass acks.
 */
import { GameMessageBus } from "./GameMessageBus";
import { RawWsMessage } from "./ingest";
import { GameStreamItem, Decorator, AnimationHint } from "./types";
import { TexasHoldemStateDTO, GameOptionsDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0001";
const ACK_TIMEOUT = 2000;

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function makeSnapshot(handNumber: number): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: handNumber,
        handNumber,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

function frame(handNumber: number): RawWsMessage {
    return {
        event: "state",
        gameId: TABLE_ID,
        data: { format: "cash", variant: "texas-holdem", gameState: makeSnapshot(handNumber) }
    };
}

const pendingFrame: RawWsMessage = { event: "pending", gameId: TABLE_ID, data: { actor: "b521x", action: "call" } };

/**
 * A decorator giving ONLY the hand-1 state item `ackCount` ack-bearing hints plus
 * an optional minDisplay. Later frames carry no ack, so the item that COMMITS
 * after the gate opens no fresh wait — keeping `pendingAcks` assertions clean.
 * ackTimeoutMs opts each hint in; the bus stamps the ackId.
 */
function ackDecorator(ackCount: number, minDisplayMs = 0, timeoutMs = ACK_TIMEOUT): Decorator {
    return item => {
        if (item.kind !== "state" || item.classified.kind !== "state" || item.classified.snapshot.handNumber !== 1) {
            return {};
        }
        const animations: AnimationHint[] = [];
        for (let i = 0; i < ackCount; i++) {
            animations.push({ kind: "dealCards", ackTimeoutMs: timeoutMs });
        }
        return minDisplayMs > 0 ? { animations, minDisplayMs } : { animations };
    };
}

function makeBus(decorator: Decorator) {
    const committed: GameStreamItem[] = [];
    const bus = new GameMessageBus({
        setLatestGameState: () => {},
        now: () => 0,
        decorators: [decorator]
    });
    bus.subscribe(item => committed.push(item));
    return { bus, committed };
}

/** Commit the head frame (flush the pre-commit timer) and return its first ackId. */
function commitAndAckId(bus: GameMessageBus, committed: GameStreamItem[], f: RawWsMessage): string {
    bus.ingest(f, TABLE_ID);
    jest.runOnlyPendingTimers();
    const last = committed[committed.length - 1];
    return last.decoration.animations[0].ackId as string;
}

describe("animation acks — drain gating", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("stamps ackId only on opted-in hints (never on decorators' behalf)", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        bus.ingest(frame(1), TABLE_ID);
        jest.runOnlyPendingTimers();
        expect(committed[0].decoration.animations[0].ackId).toBe("1:0");
    });

    it("ack-early: still commits the next item at minDisplayMs, not before", () => {
        const { bus, committed } = makeBus(ackDecorator(1, 500));
        const ackId = commitAndAckId(bus, committed, frame(1));
        expect(committed).toHaveLength(1);

        // Ack immediately, then queue the next frame.
        bus.ackAnimation(ackId);
        bus.ingest(frame(2), TABLE_ID);

        // minDisplay (500) still governs — the ack being early does not shortcut it.
        jest.advanceTimersByTime(499);
        expect(committed).toHaveLength(1);
        jest.advanceTimersByTime(1);
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(2);
        expect(bus.introspection.ackTimeouts).toBe(0);
    });

    it("ack-late: commits the next item at ack time (past minDisplay)", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        const ackId = commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);

        // minDisplay is 0 but the ack has not fired — the next commit waits.
        jest.advanceTimersByTime(800);
        expect(committed).toHaveLength(1);

        bus.ackAnimation(ackId);
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(2);
        expect(bus.introspection.ackTimeouts).toBe(0);
        expect(bus.introspection.pendingAcks).toBe(0);
    });

    it("no-ack: commits the next item at ackTimeoutMs and counts the timeout", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);

        jest.advanceTimersByTime(ACK_TIMEOUT - 1);
        expect(committed).toHaveLength(1);

        jest.advanceTimersByTime(1);
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(2);
        expect(bus.introspection.ackTimeouts).toBe(1);
        expect(bus.introspection.pendingAcks).toBe(0);
    });

    it("multiple ack-bearing hints on one item: ALL must resolve before the next commit", () => {
        const { bus, committed } = makeBus(ackDecorator(2));
        bus.ingest(frame(1), TABLE_ID);
        jest.runOnlyPendingTimers();
        const [a, b] = committed[0].decoration.animations.map(h => h.ackId as string);
        bus.ingest(frame(2), TABLE_ID);

        expect(bus.introspection.pendingAcks).toBe(2);

        // Resolve one ack. Do NOT flush timers here — the other ack's live TIMEOUT
        // is a pending timer and would fire spuriously. The gate must still hold.
        bus.ackAnimation(a);
        expect(committed).toHaveLength(1); // still one ack outstanding
        expect(bus.introspection.pendingAcks).toBe(1);

        // Resolve the second ack: only the next commit's 0ms timer is now pending.
        bus.ackAnimation(b);
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(2);
        expect(bus.introspection.pendingAcks).toBe(0);
        expect(bus.introspection.ackTimeouts).toBe(0);
    });

    it("reset() mid-wait abandons pending acks and their timers", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);
        expect(bus.introspection.pendingAcks).toBe(1);

        bus.reset();
        expect(bus.introspection.pendingAcks).toBe(0);

        // The abandoned ack's timeout must never fire (no stray timeout counted),
        // and the queued frame(2) was dropped by reset.
        jest.runAllTimers();
        expect(committed).toHaveLength(1);
        expect(bus.introspection.ackTimeouts).toBe(0);

        // A fresh frame is not blocked by the abandoned wait.
        bus.ingest(frame(5), TABLE_ID);
        jest.runAllTimers();
        expect(committed).toHaveLength(2);
    });

    it("backpressure abandons the pending ack so the queue catches up (no timeout)", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        commitAndAckId(bus, committed, frame(1));
        expect(bus.introspection.pendingAcks).toBe(1);

        // Flood the queue past the depth cap while the ack is still pending — the
        // in-flight ack wait is abandoned (compressed), not timed out.
        for (let h = 2; h <= 10; h++) {
            bus.ingest(frame(h), TABLE_ID);
        }
        expect(bus.introspection.pendingAcks).toBe(0);

        jest.runAllTimers();
        expect(bus.introspection.ackTimeouts).toBe(0);
        expect(bus.introspection.queueDepth).toBe(0);
        // Never stalled: more than the single seed frame committed.
        expect(committed.length).toBeGreaterThan(1);
    });

    it("duplicate and unknown ackIds are safe no-ops", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        const ackId = commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);

        bus.ackAnimation("nope:99"); // unknown
        expect(committed).toHaveLength(1);
        expect(bus.introspection.pendingAcks).toBe(1);

        bus.ackAnimation(ackId); // resolves
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(2);

        // Duplicate/late ack of an already-resolved id: no throw, no effect.
        expect(() => bus.ackAnimation(ackId)).not.toThrow();
        expect(bus.introspection.ackTimeouts).toBe(0);
    });

    it("non-state kinds bypass acks and jump an active ack wait", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);
        expect(bus.introspection.pendingAcks).toBe(1); // frame(1)'s ack gating

        // A pending frame arrives mid-wait — it must surface immediately.
        bus.ingest(pendingFrame, TABLE_ID);
        expect(committed).toHaveLength(2);
        expect(committed[1].kind).toBe("pending");
        // The pending item never registered an ack of its own.
        expect(bus.introspection.pendingAcks).toBe(1);
    });

    it("commits strictly one at a time across an ack gate (never two in flight)", () => {
        const { bus, committed } = makeBus(ackDecorator(1));
        const ackId = commitAndAckId(bus, committed, frame(1));
        bus.ingest(frame(2), TABLE_ID);
        bus.ingest(frame(3), TABLE_ID);

        // Both queued behind frame(1)'s ack; nothing else commits until it resolves.
        jest.advanceTimersByTime(1000);
        expect(committed).toHaveLength(1);

        bus.ackAnimation(ackId);
        jest.runOnlyPendingTimers(); // commit frame(2) (no ack of its own)
        expect(committed).toHaveLength(2);
    });
});
