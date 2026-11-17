/**
 * Paced-drain + coalescing tests (WS Action Bus, Phase 3).
 *
 * Fake-timer tests of the pacing engine: holds are honored exactly, coalescing
 * drops only coalescible non-boundary items, holds compress under sustained
 * pressure, the final state always converges to the newest frame, and reset()
 * cancels an in-flight hold timer.
 *
 * Frames are driven through the FULL pipeline (deriveEvents + the real default
 * decorators) so the tests pin end-to-end behavior, not just the timer math.
 */
import { GameMessageBus, DEPTH_CAP } from "./GameMessageBus";
import { RawWsMessage } from "./ingest";
import { GameStreamItem } from "./types";
import { SHOWDOWN_HOLD_MS } from "./decorators";
import { TexasHoldemStateDTO, GameOptionsDTO, ActionDTO, WinnerDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0001";

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

interface SnapshotOverrides {
    previousActions?: ActionDTO[];
    winners?: WinnerDTO[];
    round?: TexasHoldemRound;
    communityCards?: string[];
    actionCount?: number;
}

function makeSnapshot(handNumber: number, o: SnapshotOverrides = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: o.communityCards ?? [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: o.previousActions ?? [],
        actionCount: o.actionCount ?? handNumber,
        handNumber,
        round: o.round ?? TexasHoldemRound.PREFLOP,
        winners: o.winners ?? [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

function frame(handNumber: number, o: SnapshotOverrides = {}): RawWsMessage {
    return {
        event: "state",
        gameId: TABLE_ID,
        data: { format: "cash", variant: "texas-holdem", gameState: makeSnapshot(handNumber, o) }
    };
}

function actionAt(index: number): ActionDTO {
    return {
        playerId: "b521bot",
        seat: 2,
        action: PlayerActionType.CHECK,
        amount: "0",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: 0
    };
}

const winner: WinnerDTO = { address: "b521w", seat: 1, amount: "100", cards: [], name: "W", description: "High Card" };

function makeBus() {
    const committed: GameStreamItem[] = [];
    const bus = new GameMessageBus({
        setLatestGameState: () => {},
        now: () => 0,
        // No local address so remoteActionSound never suppresses anything.
        getLocalAddress: () => null
    });
    bus.subscribe(item => committed.push(item));
    return { bus, committed };
}

function committedHands(committed: GameStreamItem[]): number[] {
    return committed.map(i => (i.classified.kind === "state" ? i.classified.snapshot.handNumber : -1));
}

describe("paced drain", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("holds a showdown for minDisplayMs before committing the next hand", () => {
        const { bus, committed } = makeBus();

        // Seed a baseline hand so the next frame derives events against it.
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();
        expect(committed).toHaveLength(1);

        // Same hand ends: winners populated -> handEnded -> showdownHold 2000ms.
        bus.ingest(frame(1, { winners: [winner] }), TABLE_ID);
        jest.advanceTimersByTime(0);
        expect(committed).toHaveLength(2); // handEnded commits immediately...

        // ...but the next hand is held for the showdown window.
        bus.ingest(frame(2), TABLE_ID);
        jest.advanceTimersByTime(SHOWDOWN_HOLD_MS - 1);
        expect(committed).toHaveLength(2);

        jest.advanceTimersByTime(1);
        jest.runAllTimers();
        expect(committed).toHaveLength(3);
        expect(committedHands(committed)).toEqual([1, 1, 2]);
    });

    it("honors holdPreviousMs (delay before commit) then minDisplayMs (after)", () => {
        const committed: GameStreamItem[] = [];
        const bus = new GameMessageBus({
            setLatestGameState: () => {},
            now: () => 0,
            // Custom decorator: first same-hand frame holds 300ms before, 400ms after.
            decorators: [
                item => (item.kind === "state" ? { holdPreviousMs: 300, minDisplayMs: 400 } : {})
            ]
        });
        bus.subscribe(i => committed.push(i));

        bus.ingest(frame(1), TABLE_ID);
        // holdPreviousMs=300 before the very first commit.
        jest.advanceTimersByTime(299);
        expect(committed).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(committed).toHaveLength(1);

        // Next frame: 400ms (prev minDisplay) + 300ms (this holdPrevious) = 700ms.
        bus.ingest(frame(2), TABLE_ID);
        jest.advanceTimersByTime(699);
        expect(committed).toHaveLength(1);
        jest.advanceTimersByTime(1);
        expect(committed).toHaveLength(2);
    });

    it("commits pending immediately, jumping an active showdown hold", () => {
        const { bus, committed } = makeBus();
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();
        bus.ingest(frame(1, { winners: [winner] }), TABLE_ID);
        jest.advanceTimersByTime(0);
        expect(committed).toHaveLength(2);

        // Mid-hold, a pending frame arrives — it must surface at once.
        bus.ingest({ event: "pending", gameId: TABLE_ID, data: { actor: "b521x", action: "call" } }, TABLE_ID);
        expect(committed).toHaveLength(3);
        expect(committed[2].kind).toBe("pending");
    });
});

describe("coalescing / backpressure", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("drops only coalescible items under a burst, keeping the newest + handEnded", () => {
        const { bus, committed } = makeBus();

        // Seed, then commit it so the drain goes idle.
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();

        // Burst: 7 same-hand intermediate frames (each a new action -> coalescible),
        // then a handEnded frame (never coalesced). Ingested synchronously.
        const actions: ActionDTO[] = [];
        for (let i = 1; i <= 7; i++) {
            actions.push(actionAt(10 + i));
            bus.ingest(frame(1, { previousActions: [...actions], actionCount: 10 + i }), TABLE_ID);
        }
        bus.ingest(frame(1, { previousActions: [...actions], actionCount: 100, winners: [winner] }), TABLE_ID);

        jest.runAllTimers();

        const coalesced = bus.introspection.coalesced;
        expect(coalesced).toBeGreaterThan(0);

        // The handEnded frame survived and was committed.
        const anyHandEnded = committed.some(i => i.events.some(e => e.type === "handEnded"));
        expect(anyHandEnded).toBe(true);

        // Final state converged to the newest (handEnded) frame.
        const last = committed[committed.length - 1];
        expect(last.classified.kind === "state" && last.classified.snapshot.winners.length).toBe(1);

        // Fewer commits than ingests — dropping actually happened.
        expect(committed.length).toBeLessThan(bus.introspection.ingested);
    });

    it("never coalesces below the depth cap", () => {
        const { bus, committed } = makeBus();
        // DEPTH_CAP intermediate frames exactly — no coalescing.
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();
        const actions: ActionDTO[] = [];
        for (let i = 1; i <= DEPTH_CAP; i++) {
            actions.push(actionAt(20 + i));
            bus.ingest(frame(1, { previousActions: [...actions], actionCount: 20 + i }), TABLE_ID);
        }
        jest.runAllTimers();
        expect(bus.introspection.coalesced).toBe(0);
        expect(committed).toHaveLength(1 + DEPTH_CAP);
    });

    it("compresses showdown holds under sustained pressure", () => {
        const { bus } = makeBus();
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();

        // Many handEnded frames queued (each 2000ms) far exceed the 4s hold cap —
        // holds must be shortened or the queue would take >20s to drain.
        for (let h = 2; h <= 6; h++) {
            bus.ingest(frame(h, { winners: [winner] }), TABLE_ID);
        }
        // With full 2000ms holds this would need ~10s; assert it drains well under.
        jest.advanceTimersByTime(4000);
        expect(bus.introspection.queueDepth).toBe(0);
    });
});

describe("reset()", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("cancels an in-flight showdown hold timer", () => {
        const { bus, committed } = makeBus();
        bus.ingest(frame(1), TABLE_ID);
        jest.runAllTimers();
        bus.ingest(frame(1, { winners: [winner] }), TABLE_ID);
        jest.advanceTimersByTime(0);
        expect(committed).toHaveLength(2);

        // A showdown-hold cooldown is now pending. reset() must cancel it.
        bus.reset();
        jest.runAllTimers();

        // Post-reset ingest is not blocked by the cancelled hold.
        bus.ingest(frame(5), TABLE_ID);
        jest.runAllTimers();
        expect(committed).toHaveLength(3);
        expect(committed[2].classified.kind === "state" && committed[2].classified.snapshot.handNumber).toBe(5);
    });
});
