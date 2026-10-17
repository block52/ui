import {
    ActionDTO,
    GameOptionsDTO,
    NonPlayerActionType,
    PlayerActionType,
    PlayerDTO,
    PlayerStatus,
    TexasHoldemRound,
    TexasHoldemStateDTO
} from "@block52/poker-vm-sdk";
import { CLOCK_CALLER_STAGGER_MS, TIMEOUT_INCLUSION_GRACE_MS, clockCallDueAtMs, clockCallerRank, turnDeadlineMs } from "./turnClock";

const P1 = "b521seat1";
const P2 = "b521seat2";
const P3 = "b521seat3";
const P5 = "b521seat5";
const STRANGER = "b521stranger";

const T0 = 1_700_000_000_000;

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 6,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30
};

function player(address: string, seat: number): PlayerDTO {
    return {
        address,
        seat,
        stack: "1000000",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards: undefined,
        status: PlayerStatus.ACTIVE,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 30,
        signature: ""
    };
}

function action(index: number, timestamp: number, over: Partial<ActionDTO> = {}): ActionDTO {
    return { playerId: P1, seat: 1, action: PlayerActionType.CALL, amount: "0", round: TexasHoldemRound.PREFLOP, index, timestamp, ...over };
}

function state(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        dealer: 1,
        players: [player(P1, 1), player(P2, 2), player(P3, 3), player(P5, 5)],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 2,
        previousActions: [action(1, T0 - 5000), action(2, T0)],
        actionCount: 0,
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

describe("turnDeadlineMs — mirrors the engine's TurnDeadlineMs", () => {
    it("is the latest recorded action plus the timeout in seconds", () => {
        expect(turnDeadlineMs(state())).toBe(T0 + 30_000);
    });

    it("anchors on the LATEST action, not the last in the array", () => {
        const s = state({ previousActions: [action(1, T0), action(2, T0 - 5000)] });
        expect(turnDeadlineMs(s)).toBe(T0 + 30_000);
    });

    it("normalises second-resolution timestamps to milliseconds", () => {
        const s = state({ previousActions: [action(1, Math.floor(T0 / 1000))] });
        expect(turnDeadlineMs(s)).toBe(Math.floor(T0 / 1000) * 1000 + 30_000);
    });

    it("a time-bank extends the turn without re-anchoring it", () => {
        const s = state({
            gameOptions: { ...options, timeBankMs: 20_000 },
            previousActions: [action(1, T0), action(2, T0 + 25_000, { action: NonPlayerActionType.TIME_BANK, playerId: P2, seat: 2 })]
        });
        expect(turnDeadlineMs(s)).toBe(T0 + 30_000 + 20_000);
    });

    it("a time-bank from an EARLIER turn does not count", () => {
        const s = state({
            gameOptions: { ...options, timeBankMs: 20_000 },
            previousActions: [action(1, T0 - 10_000, { action: NonPlayerActionType.TIME_BANK }), action(2, T0)]
        });
        expect(turnDeadlineMs(s)).toBe(T0 + 30_000);
    });

    it("a time-bank with no timeBankMs configured extends by nothing", () => {
        const s = state({ previousActions: [action(1, T0), action(2, T0 + 1000, { action: NonPlayerActionType.TIME_BANK })] });
        expect(turnDeadlineMs(s)).toBe(T0 + 30_000);
    });

    it("has no deadline with no action clock, after the hand, with nobody to act, or before any action", () => {
        expect(turnDeadlineMs(state({ gameOptions: { ...options, timeout: 0 } }))).toBeNull();
        expect(turnDeadlineMs(state({ round: TexasHoldemRound.END }))).toBeNull();
        expect(turnDeadlineMs(state({ nextToAct: 0 }))).toBeNull();
        expect(turnDeadlineMs(state({ previousActions: [] }))).toBeNull();
        expect(turnDeadlineMs(state({ previousActions: [action(1, T0, { action: NonPlayerActionType.TIME_BANK })] }))).toBeNull();
        expect(turnDeadlineMs(undefined)).toBeNull();
        expect(turnDeadlineMs(null)).toBeNull();
    });
});

describe("clockCallerRank — the line of observers, clockwise from the button", () => {
    it("the button is first, then the seats after it in order", () => {
        // Button seat 1, seat 2 is on the clock: line = 1, 3, 5.
        expect(clockCallerRank(state(), P1)).toBe(0);
        expect(clockCallerRank(state(), P3)).toBe(1);
        expect(clockCallerRank(state(), P5)).toBe(2);
    });

    it("the player on the clock is not in the line", () => {
        expect(clockCallerRank(state(), P2)).toBeNull();
    });

    it("someone not seated at the table is not in the line", () => {
        expect(clockCallerRank(state(), STRANGER)).toBeNull();
        expect(clockCallerRank(state(), null)).toBeNull();
        expect(clockCallerRank(state(), "")).toBeNull();
    });

    it("when the button is the one on the clock, the next seat after it is first", () => {
        const s = state({ nextToAct: 1 });
        expect(clockCallerRank(s, P1)).toBeNull();
        expect(clockCallerRank(s, P2)).toBe(0);
        expect(clockCallerRank(s, P3)).toBe(1);
        expect(clockCallerRank(s, P5)).toBe(2);
    });

    it("wraps around the table: seats before the button come last", () => {
        // Button seat 5, seat 1 on the clock: line = 5, 2, 3.
        const s = state({ dealer: 5, nextToAct: 1 });
        expect(clockCallerRank(s, P5)).toBe(0);
        expect(clockCallerRank(s, P2)).toBe(1);
        expect(clockCallerRank(s, P3)).toBe(2);
    });

    it("matches the local address case-insensitively", () => {
        expect(clockCallerRank(state(), P3.toUpperCase())).toBe(1);
    });

    it("orders from seat 1 when the snapshot carries no button", () => {
        const s = state({ dealer: undefined, nextToAct: 3 });
        expect(clockCallerRank(s, P1)).toBe(0);
        expect(clockCallerRank(s, P2)).toBe(1);
        expect(clockCallerRank(s, P5)).toBe(2);
    });

    it("is null without a snapshot or players", () => {
        expect(clockCallerRank(undefined, P1)).toBeNull();
        expect(clockCallerRank(state({ players: [] }), P1)).toBeNull();
    });
});

describe("clockCallDueAtMs — deadline + inclusion grace + the caller's place in line", () => {
    it("the first in line fires right after the grace", () => {
        expect(clockCallDueAtMs(state(), P1)).toBe(T0 + 30_000 + TIMEOUT_INCLUSION_GRACE_MS);
    });

    it("each further observer waits one more stagger", () => {
        expect(clockCallDueAtMs(state(), P3)).toBe(T0 + 30_000 + TIMEOUT_INCLUSION_GRACE_MS + CLOCK_CALLER_STAGGER_MS);
        expect(clockCallDueAtMs(state(), P5)).toBe(T0 + 30_000 + TIMEOUT_INCLUSION_GRACE_MS + 2 * CLOCK_CALLER_STAGGER_MS);
    });

    it("is null for the player on the clock, a stranger, or when no turn is on the clock", () => {
        expect(clockCallDueAtMs(state(), P2)).toBeNull();
        expect(clockCallDueAtMs(state(), STRANGER)).toBeNull();
        expect(clockCallDueAtMs(state({ round: TexasHoldemRound.END }), P1)).toBeNull();
        expect(clockCallDueAtMs(state({ previousActions: [] }), P1)).toBeNull();
    });
});
