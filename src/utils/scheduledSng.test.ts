import { NonPlayerActionType, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { SCHEDULED_SNG_GRACE_MS, formatCountdown, formatLateRegistration, hasTournamentStarted, isScheduledSng, lateRegistrationEndsAt, lateRegistrationPhase, localDateTimeToUnixSeconds, scheduledSngPhase } from "./scheduledSng";
import type { GameOptionsDTO, ResultDTO } from "@block52/poker-vm-sdk";

const start = 1_700_000_000_000;

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
