import { GameMessageBus } from "./GameMessageBus";
import { RawWsMessage } from "./ingest";
import { GameStreamItem } from "./types";
import { TexasHoldemStateDTO, GameOptionsDTO } from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0001";

const validGameOptions: GameOptionsDTO = {
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
        gameOptions: validGameOptions,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: handNumber,
        handNumber,
        round: "preflop" as TexasHoldemStateDTO["round"],
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

function stateFrame(handNumber: number): RawWsMessage {
    return {
        event: "state",
        gameId: TABLE_ID,
        data: { format: "cash", variant: "texas-holdem", gameState: makeSnapshot(handNumber) }
    };
}

function errorFrame(): RawWsMessage {
    return { type: "error", message: "boom" };
}

describe("GameMessageBus", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    function makeBus() {
        const logical: Array<TexasHoldemStateDTO | undefined> = [];
        const committed: GameStreamItem[] = [];
        let clock = 0;
        const bus = new GameMessageBus({
            setLatestGameState: state => logical.push(state),
            now: () => ++clock
        });
        bus.subscribe(item => committed.push(item));
        return { bus, logical, committed };
    }

    it("assigns strictly monotonic seq numbers, never reused after reset", () => {
        const { bus, committed } = makeBus();

        bus.ingest(stateFrame(1), TABLE_ID);
        bus.ingest(stateFrame(2), TABLE_ID);
        jest.runAllTimers();
        expect(committed.map(i => i.seq)).toEqual([1, 2]);

        bus.reset();
        bus.ingest(stateFrame(3), TABLE_ID);
        jest.runAllTimers();

        // seq continues from 3 — never rewound to 1.
        expect(committed.map(i => i.seq)).toEqual([1, 2, 3]);
    });

    it("preserves FIFO order under a 20-frame synchronous burst", () => {
        const { bus, committed } = makeBus();

        for (let i = 1; i <= 20; i++) {
            bus.ingest(stateFrame(i), TABLE_ID);
        }
        // Nothing committed yet — the drain is asynchronous.
        expect(committed).toHaveLength(0);

        jest.runAllTimers();

        expect(committed.map(i => i.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
        expect(committed.map(i => (i.classified.kind === "state" ? i.classified.snapshot.handNumber : -1))).toEqual(
            Array.from({ length: 20 }, (_, i) => i + 1)
        );
    });

    it("commits strictly one at a time (never two in flight)", () => {
        const { bus, committed } = makeBus();

        for (let i = 1; i <= 5; i++) {
            bus.ingest(stateFrame(i), TABLE_ID);
        }

        // Each pending-timer flush commits exactly one item.
        for (let expected = 1; expected <= 5; expected++) {
            jest.runOnlyPendingTimers();
            expect(committed).toHaveLength(expected);
        }
    });

    it("updates the logical track at ingest, ahead of the render track", () => {
        const { bus, logical, committed } = makeBus();

        for (let i = 1; i <= 20; i++) {
            bus.ingest(stateFrame(i), TABLE_ID);
        }

        // Logical mirror already at frame 20; render track has committed nothing.
        expect(logical).toHaveLength(20);
        expect(bus.getLastSnapshot()?.handNumber).toBe(20);
        expect(committed).toHaveLength(0);

        // Drain one frame: render lags the logical track.
        jest.runOnlyPendingTimers();
        expect(committed).toHaveLength(1);
        expect(committed[0].classified.kind === "state" && committed[0].classified.snapshot.handNumber).toBe(1);
        expect(bus.getLastSnapshot()?.handNumber).toBe(20);
    });

    it("lets error frames jump the queue", () => {
        const { bus, committed } = makeBus();

        bus.ingest(stateFrame(1), TABLE_ID);
        bus.ingest(stateFrame(2), TABLE_ID);
        bus.ingest(stateFrame(3), TABLE_ID);
        bus.ingest(errorFrame(), TABLE_ID); // seq 4, but should commit first

        jest.runAllTimers();

        expect(committed[0].kind).toBe("error");
        expect(committed[0].seq).toBe(4);
        expect(committed.map(i => i.seq)).toEqual([4, 1, 2, 3]);
    });

    it("drops queued frames on reset without committing them", () => {
        const { bus, committed } = makeBus();

        bus.ingest(stateFrame(1), TABLE_ID);
        bus.ingest(stateFrame(2), TABLE_ID);
        bus.reset();
        jest.runAllTimers();

        expect(committed).toHaveLength(0);
        expect(bus.getLastSnapshot()).toBeUndefined();
    });

    it("ignores ack/unknown frames (never enqueued)", () => {
        const { bus, committed } = makeBus();

        bus.ingest({ type: "subscribed", gameId: TABLE_ID }, TABLE_ID);
        bus.ingest({ type: "somethingElse" }, TABLE_ID);
        jest.runAllTimers();

        expect(committed).toHaveLength(0);
        expect(bus.introspection.ingested).toBe(0);
    });

    it("tracks introspection counters and bounds the commit log", () => {
        const { bus } = makeBus();

        for (let i = 1; i <= 3; i++) {
            bus.ingest(stateFrame(i), TABLE_ID);
        }
        expect(bus.introspection.ingested).toBe(3);
        expect(bus.introspection.lastSeq).toBe(3);
        expect(bus.introspection.queueDepth).toBe(3);

        jest.runAllTimers();
        expect(bus.introspection.committed).toBe(3);
        expect(bus.introspection.queueDepth).toBe(0);
        expect(bus.introspection.commitLog.map(e => e.seq)).toEqual([1, 2, 3]);
        expect(bus.introspection.coalesced).toBe(0);
    });
});
