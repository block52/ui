/**
 * All-in runout expansion tests (plan: docs/plans/2026_09_09_runout_frame_expansion.md).
 *
 * End-to-end through the REAL pipeline — expandFrames + deriveEvents + the real
 * default decorators + the paced drain — so these pin the behavior the player
 * actually sees, not just the frame math.
 *
 * The case under test: the engine runs a whole all-in runout inside one
 * `performAction` with no yield point, so the client receives ONE snapshot
 * carrying five community cards, the winner and the payout all at once.
 */
import { GameMessageBus, DEPTH_CAP } from "./GameMessageBus";
import { RawWsMessage } from "./ingest";
import { GameStreamItem } from "./types";
import {
    TexasHoldemStateDTO,
    GameOptionsDTO,
    ActionDTO,
    WinnerDTO,
    PlayerDTO,
    PlayerActionType,
    PlayerStatus,
    TexasHoldemRound
} from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0002";
const BOARD = ["AS", "KD", "7C", "2H", "9S"];

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

const winner: WinnerDTO = { address: "b521w", seat: 1, amount: "100", cards: [], name: "W", description: "High Card" };

function actionAt(index: number): ActionDTO {
    return {
        playerId: "b521bot",
        seat: 2,
        action: PlayerActionType.CALL,
        amount: "1000000",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: 0
    };
}

function makeSnapshot(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: 1,
        handNumber: 1,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...over
    };
}

function frame(snapshot: TexasHoldemStateDTO): RawWsMessage {
    return {
        event: "state",
        gameId: TABLE_ID,
        data: { format: "cash", variant: "texas-holdem", gameState: snapshot }
    };
}

/** Preflop, both players all-in, board empty. */
const PREFLOP = makeSnapshot({ previousActions: [actionAt(1)], actionCount: 1 });

/** The single frame the engine sends back: runout + settlement, collapsed. */
const RESULT = makeSnapshot({
    round: TexasHoldemRound.END,
    communityCards: [...BOARD],
    previousActions: [actionAt(1), actionAt(2)],
    actionCount: 2,
    winners: [winner]
});

function makeBus() {
    const committed: GameStreamItem[] = [];
    const logical: (TexasHoldemStateDTO | undefined)[] = [];
    const bus = new GameMessageBus({
        setLatestGameState: state => logical.push(state),
        now: () => 0,
        getLocalAddress: () => null
    });
    bus.subscribe(item => committed.push(item));
    return { bus, committed, logical };
}

function boardOf(item: GameStreamItem): string[] {
    return item.classified.kind === "state" ? item.classified.snapshot.communityCards : [];
}

/** Seed the baseline preflop frame so the runout derives against it. */
function seed(bus: GameMessageBus) {
    bus.ingest(frame(PREFLOP), TABLE_ID);
    jest.runAllTimers();
}

describe("all-in runout expansion", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("commits one frame per street instead of one collapsed frame", () => {
        const { bus, committed } = makeBus();
        seed(bus);
        committed.length = 0;

        bus.ingest(frame(RESULT), TABLE_ID);
        jest.runAllTimers();

        expect(committed).toHaveLength(4);
        expect(committed.map(boardOf).map(b => b.length)).toEqual([3, 4, 5, 5]);
    });

    it("shows the winner only after the river has landed", () => {
        const { bus, committed } = makeBus();
        seed(bus);
        committed.length = 0;

        bus.ingest(frame(RESULT), TABLE_ID);
        jest.runAllTimers();

        const endedAt = committed.map(i => i.events.some(e => e.type === "handEnded"));
        expect(endedAt).toEqual([false, false, false, true]);

        // The frame that carries the winner is also the one with the full board.
        expect(boardOf(committed[3])).toEqual(BOARD);
    });

    it("hands each commit at most one street of cards to deal", () => {
        const { bus, committed } = makeBus();
        seed(bus);
        committed.length = 0;

        bus.ingest(frame(RESULT), TABLE_ID);
        jest.runAllTimers();

        const dealSizes = committed
            .flatMap(i => i.decoration.animations)
            .filter(a => a.kind === "dealCards")
            .map(a => a.cards?.length ?? 0);

        expect(dealSizes).toEqual([3, 1, 1]);
    });

    it("fires the triggering action on the first beat, not after the river", () => {
        const { bus, committed } = makeBus();
        seed(bus);
        committed.length = 0;

        bus.ingest(frame(RESULT), TABLE_ID);
        jest.runAllTimers();

        const actedAt = committed.map(i => i.events.filter(e => e.type === "playerActed").length);
        expect(actedAt).toEqual([1, 0, 0, 0]);
    });

    it("takes real time to play out rather than committing in one tick", () => {
        const { bus, committed } = makeBus();
        seed(bus);
        committed.length = 0;

        bus.ingest(frame(RESULT), TABLE_ID);
        jest.advanceTimersByTime(0);

        // Only the flop is on screen; the rest is gated on the reveal acks.
        expect(committed).toHaveLength(1);
        expect(boardOf(committed[0])).toHaveLength(3);
    });

    describe("the two-track invariant", () => {
        it("puts the REAL snapshot on the logical track, exactly once", () => {
            const { bus, logical } = makeBus();
            seed(bus);
            logical.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.runAllTimers();

            expect(logical).toEqual([RESULT]);
        });

        it("never leaks a synthetic frame onto the logical track", () => {
            const { bus, logical } = makeBus();
            seed(bus);
            logical.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.runAllTimers();

            // A projected frame's stale action indices would be rejected by the chain.
            expect(logical.every(s => s?.communityCards.length !== 3 && s?.communityCards.length !== 4)).toBe(true);
            expect(bus.getLastSnapshot()).toBe(RESULT);
        });

        it("updates the logical track immediately, before the board finishes dealing", () => {
            const { bus, committed, logical } = makeBus();
            seed(bus);
            logical.length = 0;
            committed.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);

            // Zero timer advance: nothing rendered yet, but submission is unblocked.
            expect(committed).toHaveLength(0);
            expect(logical).toEqual([RESULT]);
        });
    });

    describe("sequence and ack identity", () => {
        it("gives every sub-frame its own monotonic seq", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.runAllTimers();

            const seqs = committed.map(i => i.seq);
            expect(new Set(seqs).size).toBe(seqs.length);
            expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
        });

        it("gives every deal hint a unique ackId", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.runAllTimers();

            // Only ack-bearing hints get an id; actionBadge deliberately opts out.
            const ackIds = committed
                .flatMap(i => i.decoration.animations)
                .filter(a => a.kind === "dealCards")
                .map(a => a.ackId);

            expect(ackIds).toHaveLength(3);
            expect(ackIds.every(id => id !== undefined)).toBe(true);
            expect(new Set(ackIds).size).toBe(ackIds.length);
        });

        it("counts synthesized frames in introspection", () => {
            const { bus } = makeBus();
            seed(bus);

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.runAllTimers();

            expect(bus.introspection.expanded).toBe(3);
            // Two messages arrived; seven items were committed (1 + 4).
            expect(bus.introspection.ingested).toBe(2);
            expect(bus.introspection.committed).toBe(5);
        });
    });

    describe("backpressure", () => {
        it("does not treat its own choreography as backlog", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);
            jest.advanceTimersByTime(0);

            // The flop committed and its reveal ack is live. If the synthetic
            // frames counted toward DEPTH_CAP, `underPressure` would be set and
            // afterCommit would have dropped every ack, collapsing the runout.
            expect(bus.introspection.pendingAcks).toBeGreaterThan(0);
        });

        it("drops the choreography, but never the result, under real backlog", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(RESULT), TABLE_ID);

            // A genuine catch-up burst arrives mid-runout.
            for (let i = 2; i <= DEPTH_CAP + 3; i++) {
                bus.ingest(frame(makeSnapshot({ handNumber: i, actionCount: i + 10, previousActions: [actionAt(i + 10)] })), TABLE_ID);
            }
            jest.runAllTimers();

            // The showdown survives...
            expect(committed.some(i => i.events.some(e => e.type === "handEnded"))).toBe(true);
            // ...and the newest frame is still the last thing on screen.
            const last = committed[committed.length - 1];
            expect(last.classified.kind === "state" && last.classified.snapshot.handNumber).toBe(DEPTH_CAP + 3);
            expect(bus.introspection.coalesced).toBeGreaterThan(0);
        });
    });

    describe("hole-card reveal beat", () => {
        function seatOf(cards: string[]): PlayerDTO {
            return {
                address: "b521opp",
                seat: 2,
                stack: "1000000",
                isSmallBlind: false,
                isBigBlind: false,
                isDealer: false,
                holeCards: cards,
                status: PlayerStatus.ACTIVE,
                lastAction: undefined,
                legalActions: [],
                sumOfBets: "0",
                timeout: 30,
                signature: ""
            };
        }

        const maskedPreflop = makeSnapshot({ players: [seatOf(["X", "X"])], previousActions: [actionAt(1)] });
        const revealedResult = makeSnapshot({
            round: TexasHoldemRound.END,
            communityCards: [...BOARD],
            previousActions: [actionAt(1), actionAt(2)],
            actionCount: 2,
            winners: [winner],
            players: [seatOf(["KS", "KC"])]
        });

        function seedMasked(bus: GameMessageBus) {
            bus.ingest(frame(maskedPreflop), TABLE_ID);
            jest.runAllTimers();
        }

        it("turns the hand face up on its own beat, before the flop", () => {
            const { bus, committed } = makeBus();
            seedMasked(bus);
            committed.length = 0;

            bus.ingest(frame(revealedResult), TABLE_ID);
            jest.runAllTimers();

            expect(committed).toHaveLength(5);
            expect(boardOf(committed[0])).toEqual([]);
            expect(committed[0].events.some(e => e.type === "cardsRevealed")).toBe(true);
            expect(committed.map(boardOf).map(b => b.length)).toEqual([0, 3, 4, 5, 5]);
        });

        it("survives its own depth — five frames against DEPTH_CAP", () => {
            // The reveal case enqueues exactly DEPTH_CAP frames at once. If they
            // counted as backlog, afterCommit would drop every reveal ack and the
            // whole runout would collapse to a single tick.
            expect(DEPTH_CAP).toBe(5);

            const { bus, committed } = makeBus();
            seedMasked(bus);
            committed.length = 0;

            bus.ingest(frame(revealedResult), TABLE_ID);
            jest.advanceTimersByTime(0);

            expect(committed).toHaveLength(1);
            expect(bus.introspection.expanded).toBe(4);
        });

        it("keeps the hand face up for the rest of the runout", () => {
            const { bus, committed } = makeBus();
            seedMasked(bus);
            committed.length = 0;

            bus.ingest(frame(revealedResult), TABLE_ID);
            jest.runAllTimers();

            const holeCards = committed.map(i =>
                i.classified.kind === "state" ? i.classified.snapshot.players[0].holeCards : undefined
            );
            expect(holeCards).toEqual([
                ["KS", "KC"],
                ["KS", "KC"],
                ["KS", "KC"],
                ["KS", "KC"],
                ["KS", "KC"]
            ]);
        });
    });

    describe("normal play is untouched", () => {
        it("commits a single-street advance as one frame", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(makeSnapshot({ round: TexasHoldemRound.FLOP, communityCards: BOARD.slice(0, 3) })), TABLE_ID);
            jest.runAllTimers();

            expect(committed).toHaveLength(1);
            expect(bus.introspection.expanded).toBe(0);
        });

        it("commits a plain action frame as one frame", () => {
            const { bus, committed } = makeBus();
            seed(bus);
            committed.length = 0;

            bus.ingest(frame(makeSnapshot({ previousActions: [actionAt(1), actionAt(2)], actionCount: 2 })), TABLE_ID);
            jest.runAllTimers();

            expect(committed).toHaveLength(1);
            expect(bus.introspection.expanded).toBe(0);
        });
    });
});
