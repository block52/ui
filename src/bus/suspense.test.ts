/**
 * Tournament all-in run-out suspense (ui#873), through the REAL pipeline:
 * expandFrames + deriveEvents + the default decorators + the paced drain.
 *
 * The bug: a run-out plus its showdown went over HOLD_CAP_MS on its own, and
 * the next hand's frames piled on top, so the backpressure valve clamped every
 * hold to SHORTENED_HOLD_MS — the bigger the moment, the faster it played.
 */
import { GameMessageBus, SUSPENSE_BACKLOG_CAP } from "./GameMessageBus";
import { SHOWDOWN_HOLD_MS } from "./decorators/showdownHold";
import { RawWsMessage } from "./ingest";
import { GameStreamItem } from "./types";
import { runoutBeatHoldMs } from "./timing";
import { buildDefaultDecorators } from "./decorators";
import { TexasHoldemStateDTO, GameOptionsDTO, ActionDTO, WinnerDTO, PlayerDTO, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0873";
const BOARD = ["AS", "KD", "7C", "2H", "9S"];

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 4,
    smallBlind: "100",
    bigBlind: "200",
    timeout: 30000
};

const winner: WinnerDTO = { address: "b521w", seat: 1, amount: "2000", cards: [], name: "", description: "" };

function player(seat: number, holeCards: string[]): PlayerDTO {
    return {
        address: `b521seat${seat}`,
        seat,
        stack: "0",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards,
        status: PlayerStatus.ALL_IN,
        legalActions: [],
        sumOfBets: "0",
        timeout: 0,
        signature: ""
    } as unknown as PlayerDTO;
}

function actionAt(index: number): ActionDTO {
    return {
        playerId: "b521seat2",
        seat: 2,
        action: PlayerActionType.CALL,
        amount: "1000",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: 0
    };
}

function makeSnapshot(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [player(1, ["X", "X"]), player(2, ["X", "X"])],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [actionAt(1)],
        actionCount: 1,
        handNumber: 4,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...over
    };
}

function frame(snapshot: TexasHoldemStateDTO, format: string): RawWsMessage {
    return { event: "state", gameId: TABLE_ID, data: { format, variant: "texas-holdem", gameState: snapshot } };
}

const PREFLOP = makeSnapshot();

/** Preflop all-in: reveal, flop, turn, river, result — collapsed into one frame. */
const RESULT = makeSnapshot({
    round: TexasHoldemRound.END,
    players: [player(1, ["AH", "AD"]), player(2, ["KS", "KC"])],
    communityCards: [...BOARD],
    previousActions: [actionAt(1), actionAt(2)],
    actionCount: 2,
    winners: [winner]
});

/** A turn all-in: only the river is dealt, with the result. */
const TURN = makeSnapshot({ round: TexasHoldemRound.TURN, communityCards: BOARD.slice(0, 4) });
const TURN_RESULT = makeSnapshot({
    round: TexasHoldemRound.END,
    players: [player(1, ["AH", "AD"]), player(2, ["KS", "KC"])],
    communityCards: [...BOARD],
    previousActions: [actionAt(1), actionAt(2)],
    actionCount: 2,
    winners: [winner]
});

/** The next hand, dealt straight after (what useAutoNewHand used to do). */
function nextHand(n: number): TexasHoldemStateDTO {
    return makeSnapshot({ handNumber: 5, previousActions: [actionAt(10 + n)], actionCount: 10 + n });
}

function makeBus(reducedMotion = false) {
    const committed: Array<{ item: GameStreamItem; at: number }> = [];
    const bus = new GameMessageBus({
        setLatestGameState: () => {},
        now: () => Date.now(),
        decorators: buildDefaultDecorators(
            () => null,
            () => reducedMotion
        )
    });
    bus.subscribe(item => committed.push({ item, at: Date.now() }));
    return { bus, committed };
}

const boardSize = (item: GameStreamItem): number => (item.classified.kind === "state" ? item.classified.snapshot.communityCards.length : -1);

/** Gap between consecutive commits (ms). */
const gaps = (committed: Array<{ at: number }>): number[] => committed.slice(1).map((c, i) => c.at - committed[i].at);

describe("tournament all-in run-out suspense (ui#873)", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    function seed(bus: GameMessageBus, snapshot: TexasHoldemStateDTO, format: string) {
        bus.ingest(frame(snapshot, format), TABLE_ID);
        jest.runAllTimers();
    }

    it("tags every beat and holds each for its suspense time, even with the next hand piling on", () => {
        const { bus, committed } = makeBus();
        seed(bus, PREFLOP, "sit-and-go");
        committed.length = 0;

        bus.ingest(frame(RESULT, "sit-and-go"), TABLE_ID);
        // The next hand's frames arrive while the run-out is still showing —
        // before ui#873 this tripped the valve and every hold became 500ms.
        for (let n = 0; n < 3; n++) {
            bus.ingest(frame(nextHand(n), "sit-and-go"), TABLE_ID);
        }
        jest.runAllTimers();

        const beats = committed.map(c => c.item.runoutBeat);
        expect(beats.slice(0, 5)).toEqual(["reveal", "flop", "turn", "river", "result"]);
        expect(committed.slice(0, 5).map(c => boardSize(c.item))).toEqual([0, 3, 4, 5, 5]);
        expect(committed.slice(0, 5).every(c => c.item.decoration.protectedHold === true)).toBe(true);

        // reveal→flop, flop→turn, turn→river, river→result, result→next hand —
        // never clamped (a timer boundary may add a millisecond).
        const expected = (["reveal", "flop", "turn", "river", "result"] as const).map(b => runoutBeatHoldMs(b, false));
        gaps(committed)
            .slice(0, 5)
            .forEach((gap, i) => {
                expect(gap).toBeGreaterThanOrEqual(expected[i]);
                expect(gap).toBeLessThanOrEqual(expected[i] + 5);
            });
        // Nothing protected was coalesced away.
        expect(committed.filter(c => c.item.runoutBeat !== undefined)).toHaveLength(5);
    });

    it("reports the run-out as playing until its last hold has elapsed", () => {
        const { bus } = makeBus();
        seed(bus, PREFLOP, "sit-and-go");
        expect(bus.isPlayingSuspense()).toBe(false);

        bus.ingest(frame(RESULT, "sit-and-go"), TABLE_ID);
        expect(bus.isPlayingSuspense()).toBe(true);
        expect(bus.introspection.suspense).toBe(true);

        const total = (["reveal", "flop", "turn", "river", "result"] as const).reduce((t, b) => t + runoutBeatHoldMs(b, false), 0);
        jest.advanceTimersByTime(total - 1);
        expect(bus.isPlayingSuspense()).toBe(true);
        // + a few ms of timer boundaries between beats.
        jest.advanceTimersByTime(10);
        expect(bus.isPlayingSuspense()).toBe(false);
        expect(bus.introspection.suspense).toBe(false);
    });

    it("clears on reset, so a resubscribe can never leave the deal waiting", () => {
        const { bus } = makeBus();
        seed(bus, PREFLOP, "sit-and-go");
        bus.ingest(frame(RESULT, "sit-and-go"), TABLE_ID);
        expect(bus.isPlayingSuspense()).toBe(true);
        bus.reset();
        expect(bus.isPlayingSuspense()).toBe(false);
    });

    it("splits a turn all-in so the river lands before the winner", () => {
        const { bus, committed } = makeBus();
        seed(bus, TURN, "tournament");
        committed.length = 0;

        bus.ingest(frame(TURN_RESULT, "tournament"), TABLE_ID);
        jest.runAllTimers();

        expect(committed.map(c => c.item.runoutBeat)).toEqual(["reveal", "river", "result"]);
        expect(committed.map(c => boardSize(c.item))).toEqual([4, 5, 5]);
        const endedAt = committed.map(c => c.item.events.some(e => e.type === "handEnded"));
        expect(endedAt).toEqual([false, false, true]);
    });

    it("uses shorter pauses under prefers-reduced-motion", () => {
        const { bus, committed } = makeBus(true);
        seed(bus, PREFLOP, "sit-and-go");
        committed.length = 0;

        bus.ingest(frame(RESULT, "sit-and-go"), TABLE_ID);
        bus.ingest(frame(nextHand(0), "sit-and-go"), TABLE_ID);
        jest.runAllTimers();

        const gapsMs = gaps(committed).slice(0, 4);
        const full = (["reveal", "flop", "turn", "river"] as const).map(b => runoutBeatHoldMs(b, false));
        gapsMs.forEach((gap, i) => expect(gap).toBeLessThan(full[i]));
    });

    it("still snaps past the run-out when the client is genuinely far behind", () => {
        const { bus, committed } = makeBus();
        seed(bus, PREFLOP, "sit-and-go");
        committed.length = 0;

        bus.ingest(frame(RESULT, "sit-and-go"), TABLE_ID);
        for (let n = 0; n <= SUSPENSE_BACKLOG_CAP; n++) {
            bus.ingest(frame(nextHand(n), "sit-and-go"), TABLE_ID);
        }
        jest.runAllTimers();

        // Synthetic beats were coalesced; the result (a hand boundary) survives.
        expect(bus.introspection.coalesced).toBeGreaterThan(0);
        expect(committed.some(c => c.item.runoutBeat === "result")).toBe(true);
        expect(committed.some(c => c.item.runoutBeat === "flop")).toBe(false);
    });

    describe("cash games are unchanged", () => {
        it("carries no suspense holds and does not split a turn all-in", () => {
            const { bus, committed } = makeBus();
            seed(bus, TURN, "cash");
            committed.length = 0;

            bus.ingest(frame(TURN_RESULT, "cash"), TABLE_ID);
            jest.runAllTimers();

            expect(committed).toHaveLength(1);
            expect(committed[0].item.decoration.protectedHold).toBeUndefined();
            expect(bus.isPlayingSuspense()).toBe(false);
        });

        it("keeps the ordinary showdown hold on a cash run-out", () => {
            const { bus, committed } = makeBus();
            seed(bus, PREFLOP, "cash");
            committed.length = 0;

            bus.ingest(frame(RESULT, "cash"), TABLE_ID);
            for (let n = 0; n < 6; n++) {
                bus.ingest(frame(nextHand(n), "cash"), TABLE_ID);
            }
            jest.runAllTimers();

            const resultIndex = committed.findIndex(c => c.item.events.some(e => e.type === "handEnded"));
            expect(committed[resultIndex].item.runoutBeat).toBe("result");
            expect(committed[resultIndex].item.decoration.protectedHold).toBeUndefined();
            expect(committed[resultIndex + 1].at - committed[resultIndex].at).toBeLessThanOrEqual(SHOWDOWN_HOLD_MS);
        });
    });
});
