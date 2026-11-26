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
import {
    CLOCK_CALLER_STAGGER_MS,
    TIMEOUT_BLOCK_TIME_MARGIN_MS,
    TIMEOUT_INCLUSION_GRACE_MS,
    clockCallDueAtMs,
    clockCallOpportunity,
    clockCallerRank,
    PREFLOP_TIMEOUT_SECONDS,
    TURN_CLOCK_START_ALLOWANCE_MS,
    timeBankGrantedMs,
    turnClockPhase,
    turnCountdownStartMs,
    turnDeadlineMs,
    turnTimeoutSeconds
} from "./turnClock";

/** The turn clock starts one block interval after its anchor (ui#944). */
const A = TURN_CLOCK_START_ALLOWANCE_MS;

const WAIT = TIMEOUT_INCLUSION_GRACE_MS + TIMEOUT_BLOCK_TIME_MARGIN_MS;

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

/** A player whose latest time-bank use granted `ms` (engine field, newer than SDK 1.15.0's PlayerDTO type). */
function withGrant(p: PlayerDTO, ms: number): PlayerDTO {
    return Object.assign(p, { timeBankLastGrantMs: ms });
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
        round: TexasHoldemRound.FLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...over
    };
}

describe("turnTimeoutSeconds — 15s pre-flop, the table's clock after (poker-vm#2143)", () => {
    it("caps the pre-flop clock at 15s", () => {
        expect(PREFLOP_TIMEOUT_SECONDS).toBe(15);
        expect(turnTimeoutSeconds(25, TexasHoldemRound.PREFLOP)).toBe(15);
        expect(turnTimeoutSeconds(30, TexasHoldemRound.PREFLOP)).toBe(15);
    });

    it("gives the flop, turn and river the table's full clock", () => {
        for (const round of [TexasHoldemRound.FLOP, TexasHoldemRound.TURN, TexasHoldemRound.RIVER]) {
            expect(turnTimeoutSeconds(25, round)).toBe(25);
        }
    });

    it("keeps a table's own clock pre-flop when it is already 15s or shorter", () => {
        expect(turnTimeoutSeconds(15, TexasHoldemRound.PREFLOP)).toBe(15);
        expect(turnTimeoutSeconds(10, TexasHoldemRound.PREFLOP)).toBe(10);
    });
});

describe("turnDeadlineMs — mirrors the engine's TurnDeadlineMs", () => {
    it("runs 15s pre-flop and the full timeout on the flop", () => {
        expect(turnDeadlineMs(state({ round: TexasHoldemRound.PREFLOP }))).toBe(T0 + A + 15_000);
        expect(turnDeadlineMs(state({ round: TexasHoldemRound.FLOP }))).toBe(T0 + A + 30_000);
    });

    it("adds the time bank on top of the 15s pre-flop clock", () => {
        const s = state({
            round: TexasHoldemRound.PREFLOP,
            players: [player(P1, 1), withGrant(player(P2, 2), 45_000), player(P3, 3), player(P5, 5)],
            previousActions: [action(1, T0), action(2, T0 + 10_000, { action: NonPlayerActionType.TIME_BANK, playerId: P2, seat: 2 })]
        });
        expect(turnDeadlineMs(s)).toBe(T0 + A + 15_000 + 45_000);
    });

    it("is the latest recorded action plus the timeout in seconds", () => {
        expect(turnDeadlineMs(state())).toBe(T0 + A + 30_000);
    });

    it("anchors on the LATEST action, not the last in the array", () => {
        const s = state({ previousActions: [action(1, T0), action(2, T0 - 5000)] });
        expect(turnDeadlineMs(s)).toBe(T0 + A + 30_000);
    });

    it("normalises second-resolution timestamps to milliseconds", () => {
        const s = state({ previousActions: [action(1, Math.floor(T0 / 1000))] });
        expect(turnDeadlineMs(s)).toBe(Math.floor(T0 / 1000) * 1000 + A + 30_000);
    });

    it("a time-bank extends the turn by what that use granted, without re-anchoring it", () => {
        const s = state({
            gameOptions: { ...options, timeBankMs: 45_000 },
            players: [player(P1, 1), withGrant(player(P2, 2), 30_000), player(P3, 3), player(P5, 5)],
            previousActions: [action(1, T0), action(2, T0 + 25_000, { action: NonPlayerActionType.TIME_BANK, playerId: P2, seat: 2 })]
        });
        // the second use grants 30s, not the table's 45s first extension
        expect(turnDeadlineMs(s)).toBe(T0 + A + 30_000 + 30_000);
    });

    it("a tap in the same block as the move does not count against the next turn (ui#944)", () => {
        const s = state({
            players: [player(P1, 1), withGrant(player(P2, 2), 45_000), player(P3, 3), player(P5, 5)],
            previousActions: [
                action(1, T0, { action: NonPlayerActionType.TIME_BANK, playerId: P2, seat: 2 }),
                action(2, T0, { action: PlayerActionType.CHECK, playerId: P2, seat: 2 })
            ]
        });
        expect(timeBankGrantedMs(s)).toBe(0);
        expect(turnDeadlineMs(s)).toBe(T0 + A + 30_000);
    });

    it("a time-bank from an EARLIER turn does not count", () => {
        const s = state({
            gameOptions: { ...options, timeBankMs: 20_000 },
            previousActions: [action(1, T0 - 10_000, { action: NonPlayerActionType.TIME_BANK }), action(2, T0)]
        });
        expect(turnDeadlineMs(s)).toBe(T0 + A + 30_000);
    });

    it("a time-bank with no grant recorded for its player extends by nothing", () => {
        const s = state({ previousActions: [action(1, T0), action(2, T0 + 1000, { action: NonPlayerActionType.TIME_BANK })] });
        expect(turnDeadlineMs(s)).toBe(T0 + A + 30_000);
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

    it("nobody is in the line when the snapshot carries no button (no invented order)", () => {
        const s = state({ dealer: undefined, nextToAct: 3 });
        expect(clockCallerRank(s, P1)).toBeNull();
        expect(clockCallerRank(s, P2)).toBeNull();
        expect(clockCallerRank(s, P5)).toBeNull();
    });

    it("is null without a snapshot or players", () => {
        expect(clockCallerRank(undefined, P1)).toBeNull();
        expect(clockCallerRank(state({ players: [] }), P1)).toBeNull();
    });
});

describe("clockCallDueAtMs — deadline + inclusion grace + block-time margin + the caller's place in line", () => {
    it("the first in line fires one block interval after the grace", () => {
        expect(clockCallDueAtMs(state(), P1)).toBe(T0 + A + 30_000 + WAIT);
    });

    it("each further observer waits one more stagger", () => {
        expect(clockCallDueAtMs(state(), P3)).toBe(T0 + A + 30_000 + WAIT + CLOCK_CALLER_STAGGER_MS);
        expect(clockCallDueAtMs(state(), P5)).toBe(T0 + A + 30_000 + WAIT + 2 * CLOCK_CALLER_STAGGER_MS);
    });

    it("is null for the player on the clock, a stranger, or when no turn is on the clock", () => {
        expect(clockCallDueAtMs(state(), P2)).toBeNull();
        expect(clockCallDueAtMs(state(), STRANGER)).toBeNull();
        expect(clockCallDueAtMs(state({ round: TexasHoldemRound.END }), P1)).toBeNull();
        expect(clockCallDueAtMs(state({ previousActions: [] }), P1)).toBeNull();
    });
});

describe("clockCallOpportunity — no clock call before a tournament starts (ui#898)", () => {
    const join = (index: number, seat: number, playerId: string) =>
        action(index, T0 - 5000 + index, { seat, playerId, action: NonPlayerActionType.JOIN, round: TexasHoldemRound.ANTE });
    const lobby = state({ round: TexasHoldemRound.ANTE, nextToAct: 1, previousActions: [join(1, 1, P1), join(2, 2, P2)] });

    it("a waiting sit-and-go lobby has no turn to call, though its joins anchor a deadline", () => {
        expect(clockCallOpportunity(lobby, P2, false)).not.toBeNull();
        expect(clockCallOpportunity(lobby, P2, true)).toBeNull();
    });

    it("calls once the tournament has started (a blind is posted, or past hand 1)", () => {
        const posted = state({
            round: TexasHoldemRound.ANTE,
            nextToAct: 2,
            previousActions: [join(1, 1, P1), join(2, 2, P2), action(3, T0, { seat: 1, playerId: P1, action: PlayerActionType.SMALL_BLIND, round: TexasHoldemRound.ANTE })]
        });
        expect(clockCallOpportunity(posted, P1, true)).not.toBeNull();
        expect(clockCallOpportunity(state({ handNumber: 2 }), P1, true)).not.toBeNull();
    });
});

describe("clockCallOpportunity — the turn to call, keyed on the turn rather than the due time", () => {
    it("carries the turn key, the seat on the clock and the due time", () => {
        expect(clockCallOpportunity(state(), P1, false)).toEqual({ key: "1:2:2", seat: 2, dueAtMs: T0 + A + 30_000 + WAIT });
    });

    it("keeps its key when the anchoring action is re-stamped (same turn, later due time)", () => {
        const before = clockCallOpportunity(state(), P1, false);
        const after = clockCallOpportunity(state({ previousActions: [action(1, T0 - 5000), action(2, T0 + 1000)] }), P1, false);
        expect(after?.key).toBe(before?.key);
        expect(after?.dueAtMs).toBe((before?.dueAtMs ?? 0) + 1000);
    });

    it("changes its key when the turn moves on, and across hands", () => {
        const base = clockCallOpportunity(state(), P1, false)?.key;
        expect(clockCallOpportunity(state({ nextToAct: 3 }), P1, false)?.key).not.toBe(base);
        expect(clockCallOpportunity(state({ previousActions: [action(1, T0 - 5000), action(2, T0), action(3, T0, { seat: 2, playerId: P2 })] }), P1, false)?.key).not.toBe(base);
        expect(clockCallOpportunity(state({ handNumber: 2 }), P1, false)?.key).not.toBe(base);
    });

    it("is null whenever there is no due time", () => {
        expect(clockCallOpportunity(state(), P2, false)).toBeNull();
        expect(clockCallOpportunity(state({ round: TexasHoldemRound.END }), P1, false)).toBeNull();
        expect(clockCallOpportunity(undefined, P1, false)).toBeNull();
    });
});

describe("turnClockPhase — the turn clock runs out first, then the bank (ui#19)", () => {
    const anchorMs = 1_000_000;
    const baseMs = 15_000;

    it("counts the turn clock down while no bank is used", () => {
        expect(turnClockPhase({ nowMs: anchorMs + 4_000, anchorMs, baseMs, bankGrantedMs: 0 })).toEqual({ phase: "base", remainingMs: 11_000, totalMs: 15_000 });
    });

    it("keeps counting the turn clock after the bank is tapped, so none of it is lost", () => {
        // tapped with 11s left: still 11s on the turn clock, the bank waits
        expect(turnClockPhase({ nowMs: anchorMs + 4_000, anchorMs, baseMs, bankGrantedMs: 45_000 })).toEqual({ phase: "base", remainingMs: 11_000, totalMs: 15_000 });
    });

    it("switches to the full bank when the turn clock reaches zero", () => {
        expect(turnClockPhase({ nowMs: anchorMs + 15_000, anchorMs, baseMs, bankGrantedMs: 45_000 })).toEqual({ phase: "bank", remainingMs: 45_000, totalMs: 45_000 });
        expect(turnClockPhase({ nowMs: anchorMs + 25_000, anchorMs, baseMs, bankGrantedMs: 45_000 })).toEqual({ phase: "bank", remainingMs: 35_000, totalMs: 45_000 });
    });

    it("reads 0, never negative, once everything is spent", () => {
        expect(turnClockPhase({ nowMs: anchorMs + 90_000, anchorMs, baseMs, bankGrantedMs: 45_000 })).toEqual({ phase: "bank", remainingMs: 0, totalMs: 45_000 });
        expect(turnClockPhase({ nowMs: anchorMs + 90_000, anchorMs, baseMs, bankGrantedMs: 0 })).toEqual({ phase: "base", remainingMs: 0, totalMs: 15_000 });
    });
});

describe("turn clock start allowance (ui#944)", () => {
    it("starts the clock one 5s block after the move's stamp", () => {
        expect(TURN_CLOCK_START_ALLOWANCE_MS).toBe(5_000);
        // pre-flop: 15s of clock that begins 5s after the stamp
        expect(turnDeadlineMs(state({ round: TexasHoldemRound.PREFLOP }))).toBe(T0 + 5_000 + 15_000);
    });
});

describe("turnClockPhase before the clock starts (ui#944)", () => {
    it("shows the full turn clock, never more", () => {
        expect(turnClockPhase({ nowMs: 7_000, anchorMs: 10_000, baseMs: 15_000, bankGrantedMs: 0 })).toEqual({ phase: "base", remainingMs: 15_000, totalMs: 15_000 });
    });
});

describe("turnCountdownStartMs (ui#944)", () => {
    it("counts a committed turn from the chain's clock start", () => {
        expect(turnCountdownStartMs(10_000, false, 99_000)).toBe(15_000);
    });

    it("counts a turn first seen on a projection from now, because its stamp is stale", () => {
        expect(turnCountdownStartMs(10_000, true, 12_345)).toBe(12_345);
    });
});
