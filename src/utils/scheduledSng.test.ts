import { NonPlayerActionType, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { LATE_REGISTRATION_LEVEL_OPTIONS, SCHEDULED_SNG_GRACE_MS, formatCountdown, formatLateRegistration, lateRegistrationOptionLabel, hasTournamentFinished, hasTournamentStarted, isScheduledSng, lateRegistrationEndsAt, lateRegistrationPhase, localDateTimeToUnixSeconds, scheduledSngPhase, isAwaitingTournamentStart, shouldAutoStart, tournamentStartRule, waitingProgressText, waitsForStartTime } from "./scheduledSng";
import type { ActionDTO, GameOptionsDTO, ResultDTO } from "@block52/poker-vm-sdk";
import type { ScheduledSngPhase } from "./scheduledSng";

const start = 1_700_000_000_000;

describe("waitsForStartTime", () => {
    it("is true only when the table says so", () => {
        expect(waitsForStartTime({ waitForStartTime: true })).toBe(true);
        expect(waitsForStartTime({ waitForStartTime: false })).toBe(false);
        expect(waitsForStartTime({})).toBe(false);
        expect(waitsForStartTime(null)).toBe(false);
        expect(waitsForStartTime(undefined)).toBe(false);
    });
});

describe("isAwaitingTournamentStart", () => {
    const opts = (extra: Partial<GameOptionsDTO> = {}) => ({ scheduledStartTime: start, ...extra }) as GameOptionsDTO;
    const notStarted = (extra: Partial<GameOptionsDTO> = {}) => ({ handNumber: 1, previousActions: [], gameOptions: opts(extra) });
    const started = (extra: Partial<GameOptionsDTO> = {}) => ({
        handNumber: 1,
        previousActions: [{ action: NonPlayerActionType.START }] as unknown as ActionDTO[],
        gameOptions: opts(extra)
    });
    const input = { isUserAlreadyPlaying: true, hasEmptySeats: true };

    it.each(["sit-and-go", "tournament"])("waits on empty seats for a %s", gameFormat => {
        expect(isAwaitingTournamentStart({ ...input, gameFormat, gameState: notStarted() })).toBe(true);
    });

    it("keeps a full table that holds for its start time waiting, so START still gets sent", () => {
        expect(isAwaitingTournamentStart({ ...input, hasEmptySeats: false, gameFormat: "tournament", gameState: notStarted({ waitForStartTime: true }) })).toBe(true);
    });

    it("lets a full table without the hold go, because the engine deals it at once", () => {
        expect(isAwaitingTournamentStart({ ...input, hasEmptySeats: false, gameFormat: "sit-and-go", gameState: notStarted() })).toBe(false);
    });

    it("stops waiting once it has started, full or not", () => {
        expect(isAwaitingTournamentStart({ ...input, gameFormat: "tournament", gameState: started({ waitForStartTime: true }) })).toBe(false);
        expect(isAwaitingTournamentStart({ ...input, hasEmptySeats: false, gameFormat: "tournament", gameState: started({ waitForStartTime: true }) })).toBe(false);
    });

    it("is never true for cash, or for someone not seated", () => {
        expect(isAwaitingTournamentStart({ ...input, gameFormat: "cash", gameState: notStarted({ waitForStartTime: true }) })).toBe(false);
        expect(isAwaitingTournamentStart({ ...input, isUserAlreadyPlaying: false, gameFormat: "tournament", gameState: notStarted({ waitForStartTime: true }) })).toBe(false);
    });
});

describe("shouldAutoStart", () => {
    it("sends START once the start time has come with the minimum registered", () => {
        expect(shouldAutoStart("ready", false)).toBe(true);
    });
    it("sends START when the engine offers it", () => {
        expect(shouldAutoStart("registering", true)).toBe(true);
    });
    it.each(["unscheduled", "registering", "short", "cancelled"] as const)("does not send it while %s", phase => {
        expect(shouldAutoStart(phase, false)).toBe(false);
    });
});

describe("tournamentStartRule", () => {
    it("says what each kind of table does", () => {
        expect(tournamentStartRule({})).toBe("Tournament starts when all players are seated");
        expect(tournamentStartRule({ scheduledStartTime: start, waitForStartTime: true })).toBe("Starts at the start time with at least the minimum");
        expect(tournamentStartRule({ scheduledStartTime: start })).toBe("Starts when the table is full, or at the start time with at least the minimum");
    });
});

describe("waitingProgressText", () => {
    const text = (waits: boolean, registered: number, minPlayers: number, maxPlayers: number, phase: ScheduledSngPhase = "registering") =>
        waitingProgressText({ waits, phase, registered, minPlayers, maxPlayers });

    it("counts up to a full table when it starts on filling", () => {
        expect(text(false, 3, 6, 6, "unscheduled")).toBe("Waiting for 3 more players");
        expect(text(false, 5, 6, 6, "unscheduled")).toBe("Waiting for 1 more player");
    });
    it("counts up to the minimum when it holds for its start time", () => {
        expect(text(true, 1, 3, 9)).toBe("Waiting for 2 more players to reach the minimum");
        expect(text(true, 2, 3, 9)).toBe("Waiting for 1 more player to reach the minimum");
    });
    it("says so once the minimum is reached, full or not", () => {
        expect(text(true, 3, 3, 9)).toBe("Minimum reached, waiting for the start time");
        expect(text(true, 9, 3, 9)).toBe("Minimum reached, waiting for the start time");
    });
    it("stops talking about waiting once the start time has come", () => {
        expect(text(true, 9, 3, 9, "ready")).toBe("Minimum reached, ready to start");
        expect(text(false, 3, 2, 9, "ready")).toBe("Minimum reached, ready to start");
    });
});

describe("scheduledSngPhase", () => {
    it("is unscheduled without a start time", () => {
        expect(scheduledSngPhase({ scheduledStartTime: undefined, minPlayers: 2, registered: 1, nowMs: start })).toBe("unscheduled");
        expect(scheduledSngPhase({ scheduledStartTime: 0, minPlayers: 2, registered: 1, nowMs: start })).toBe("unscheduled");
    });
    it("registers before the start time", () => {
        expect(scheduledSngPhase({ scheduledStartTime: start, minPlayers: 2, registered: 5, nowMs: start - 1 })).toBe("registering");
    });
    it("is ready at the start time with enough players", () => {
        expect(scheduledSngPhase({ scheduledStartTime: start, minPlayers: 2, registered: 2, nowMs: start })).toBe("ready");
    });
    it("is short inside the grace window, then cancelled", () => {
        expect(scheduledSngPhase({ scheduledStartTime: start, minPlayers: 4, registered: 3, nowMs: start + SCHEDULED_SNG_GRACE_MS - 1 })).toBe("short");
        expect(scheduledSngPhase({ scheduledStartTime: start, minPlayers: 4, registered: 3, nowMs: start + SCHEDULED_SNG_GRACE_MS })).toBe("cancelled");
    });
});

describe("hasTournamentFinished", () => {
    const result = (place: number): ResultDTO => ({ place, playerId: `b521p${place}`, payout: "0" });
    it("is false before anyone has a place, and while players are only busting out", () => {
        expect(hasTournamentFinished({ results: [] })).toBe(false);
        expect(hasTournamentFinished({ results: [result(4), result(3)] })).toBe(false);
        expect(hasTournamentFinished(undefined)).toBe(false);
        expect(hasTournamentFinished(null)).toBe(false);
    });
    it("is true once 1st place is recorded", () => {
        expect(hasTournamentFinished({ results: [result(4), result(3), result(2), result(1)] })).toBe(true);
    });
});

describe("hasTournamentStarted", () => {
    const action = (a: string) => ({ playerId: "b521x", seat: 1, action: a as PlayerActionType, amount: "0", round: TexasHoldemRound.ANTE, index: 1, timestamp: 0 });
    it("is false while registering", () => {
        expect(hasTournamentStarted({ handNumber: 1, previousActions: [action(NonPlayerActionType.JOIN)] })).toBe(false);
        expect(hasTournamentStarted(undefined)).toBe(false);
    });
    it("is true once START or a blind is recorded, or past hand 1", () => {
        expect(hasTournamentStarted({ handNumber: 1, previousActions: [action(NonPlayerActionType.START)] })).toBe(true);
        expect(hasTournamentStarted({ handNumber: 1, previousActions: [action(PlayerActionType.SMALL_BLIND)] })).toBe(true);
        expect(hasTournamentStarted({ handNumber: 2, previousActions: [] })).toBe(true);
    });
});

describe("formatting", () => {
    it("counts down in m:ss and h:mm:ss, floored at 0:00", () => {
        expect(formatCountdown(start + 754_000, start)).toBe("12:34");
        expect(formatCountdown(start + 3_661_000, start)).toBe("1:01:01");
        expect(formatCountdown(start - 5_000, start)).toBe("0:00");
    });
    it("reads a datetime-local value as unix seconds", () => {
        const secs = localDateTimeToUnixSeconds("2026-10-15T20:30");
        expect(secs).toBe(Math.floor(new Date("2026-10-15T20:30").getTime() / 1000));
        expect(Number.isNaN(localDateTimeToUnixSeconds(""))).toBe(true);
    });
    it("detects a scheduled table from its options", () => {
        expect(isScheduledSng({ scheduledStartTime: start })).toBe(true);
        expect(isScheduledSng({})).toBe(false);
        expect(isScheduledSng(null)).toBe(false);
    });
});

describe("late registration (poker-vm#2731)", () => {
    const firstDeal = 1_700_000_000_000;
    const options = (extra: Partial<GameOptionsDTO> = {}): GameOptionsDTO => ({
        minBuyIn: "1000000", maxBuyIn: "1000000", minPlayers: 2, maxPlayers: 9, smallBlind: "50", bigBlind: "100", timeout: 30,
        blindLevelDuration: 10, scheduledStartTime: firstDeal - 60_000, lateRegistrationLevels: 2, sngStartTime: firstDeal, ...extra
    });
    const started = { handNumber: 3, previousActions: [] };
    const state = (extra: Partial<GameOptionsDTO> = {}, results: ResultDTO[] = []) => ({ ...started, gameOptions: options(extra), results });

    it("is none before the start, or without the option", () => {
        expect(lateRegistrationPhase({ ...state(), handNumber: 1 }, firstDeal)).toBe("none");
        expect(lateRegistrationPhase(state({ lateRegistrationLevels: undefined }), firstDeal)).toBe("none");
        expect(lateRegistrationPhase(null, firstDeal)).toBe("none");
    });

    it("is open inside the window and closed after it", () => {
        expect(lateRegistrationPhase(state(), firstDeal + 19 * 60_000)).toBe("open");
        expect(lateRegistrationPhase(state(), firstDeal + 20 * 60_000)).toBe("closed");
        expect(lateRegistrationEndsAt(options())).toBe(firstDeal + 20 * 60_000);
    });

    it("closes once anyone has finished in the money", () => {
        expect(lateRegistrationPhase(state({}, [{ place: 3, playerId: "b52third", payout: "1260000" }]), firstDeal)).toBe("closed");
        expect(lateRegistrationPhase(state({}, [{ place: 7, playerId: "b52bust", payout: "0" }]), firstDeal)).toBe("open");
    });

    it("labels the window", () => {
        expect(formatLateRegistration(3)).toBe("Late reg: 3 levels");
        expect(formatLateRegistration(1)).toBe("Late reg: 1 level");
        expect(formatLateRegistration(undefined)).toBe("");
        expect(formatLateRegistration(0)).toBe("");
    });
});

describe("late registration create choices (ui#881)", () => {
    it("starts with off and offers whole levels", () => {
        expect(LATE_REGISTRATION_LEVEL_OPTIONS[0]).toBe(0);
        expect(LATE_REGISTRATION_LEVEL_OPTIONS.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
    });
    it("labels each choice", () => {
        expect(lateRegistrationOptionLabel(0)).toBe("Off: the field is fixed at the start");
        expect(lateRegistrationOptionLabel(1)).toBe("Open for the first 1 blind level");
        expect(lateRegistrationOptionLabel(3)).toBe("Open for the first 3 blind levels");
    });
});
