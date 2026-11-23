import type { BlindStructureDTO } from "@block52/poker-vm-sdk";
import {
    DEFAULT_TOURNAMENT_LATE_REGISTRATION_LEVELS,
    formatTournamentLateRegistration,
    isValidLateRegistrationLevels,
    lateRegistrationCutoffAt,
    lateRegistrationDurationMinutes,
    tournamentLateRegistrationLabel
} from "./tournamentLateRegistration";

// Every level 10 minutes long: levels 0..N-1 sum to N*10 minutes.
const DOUBLE_10: BlindStructureDTO = { progression: "double", startSmallBlind: "25", startBigBlind: "50", durationMinutes: 10 };

// A hand-crafted table with a break level that still consumes wall-clock.
const TABLE_WITH_BREAK: BlindStructureDTO = {
    progression: "table",
    levels: [
        { level: 0, smallBlind: "25", bigBlind: "50", ante: "0", durationMinutes: 10, isBreak: false },
        { level: 1, smallBlind: "0", bigBlind: "0", ante: "0", durationMinutes: 5, isBreak: true },
        { level: 2, smallBlind: "50", bigBlind: "100", ante: "0", durationMinutes: 10, isBreak: false }
    ]
};

describe("DEFAULT_TOURNAMENT_LATE_REGISTRATION_LEVELS", () => {
    it("is 15, the issue's pre-filled default", () => {
        expect(DEFAULT_TOURNAMENT_LATE_REGISTRATION_LEVELS).toBe(15);
    });
});

describe("isValidLateRegistrationLevels", () => {
    it("accepts off (0) and any positive whole number", () => {
        expect(isValidLateRegistrationLevels(0)).toBe(true);
        expect(isValidLateRegistrationLevels(1)).toBe(true);
        expect(isValidLateRegistrationLevels(15)).toBe(true);
    });

    it("rejects negatives and non-integers", () => {
        expect(isValidLateRegistrationLevels(-1)).toBe(false);
        expect(isValidLateRegistrationLevels(2.5)).toBe(false);
        expect(isValidLateRegistrationLevels(NaN)).toBe(false);
    });
});

describe("lateRegistrationDurationMinutes", () => {
    it("sums the first N level durations (equal levels)", () => {
        expect(lateRegistrationDurationMinutes(DOUBLE_10, 3)).toBe(30);
        expect(lateRegistrationDurationMinutes(DOUBLE_10, 15)).toBe(150);
    });

    it("counts a break level's minutes within the window", () => {
        // levels 0..1 = 10 + 5 (the break) = 15 minutes.
        expect(lateRegistrationDurationMinutes(TABLE_WITH_BREAK, 2)).toBe(15);
        // levels 0..2 = 10 + 5 + 10 = 25.
        expect(lateRegistrationDurationMinutes(TABLE_WITH_BREAK, 3)).toBe(25);
    });

    it("is undefined when off or invalid", () => {
        expect(lateRegistrationDurationMinutes(DOUBLE_10, 0)).toBeUndefined();
        expect(lateRegistrationDurationMinutes(DOUBLE_10, -2)).toBeUndefined();
        expect(lateRegistrationDurationMinutes(DOUBLE_10, 1.5)).toBeUndefined();
    });
});

describe("lateRegistrationCutoffAt", () => {
    const start = Date.UTC(2026, 0, 1, 20, 0, 0); // 20:00

    it("adds the first N levels' minutes to the scheduled start", () => {
        // 15 levels * 10 min = 150 min = 2h30m after 20:00 -> 22:30.
        expect(lateRegistrationCutoffAt(DOUBLE_10, 15, start)).toBe(Date.UTC(2026, 0, 1, 22, 30, 0));
    });

    it("is undefined when off, or when the start is unknown", () => {
        expect(lateRegistrationCutoffAt(DOUBLE_10, 0, start)).toBeUndefined();
        expect(lateRegistrationCutoffAt(DOUBLE_10, 15, undefined)).toBeUndefined();
    });
});

describe("tournamentLateRegistrationLabel", () => {
    it("describes an open window with pluralised levels", () => {
        expect(tournamentLateRegistrationLabel(1)).toBe("Open for the first 1 blind level");
        expect(tournamentLateRegistrationLabel(15)).toBe("Open for the first 15 blind levels");
    });

    it("describes off", () => {
        expect(tournamentLateRegistrationLabel(0)).toBe("Off: the field is fixed at the start");
        expect(tournamentLateRegistrationLabel(-1)).toBe("Off: the field is fixed at the start");
    });
});

describe("formatTournamentLateRegistration", () => {
    it("shows the target level while open", () => {
        expect(formatTournamentLateRegistration(15, false)).toBe("Late reg: until level 15");
        expect(formatTournamentLateRegistration(3, false)).toBe("Late reg: until level 3");
    });

    it("shows closed once the engine has shut the window", () => {
        expect(formatTournamentLateRegistration(15, true)).toBe("Late reg closed");
    });

    it("is empty for a tournament with no late registration", () => {
        expect(formatTournamentLateRegistration(0, false)).toBe("");
        expect(formatTournamentLateRegistration(undefined, false)).toBe("");
        expect(formatTournamentLateRegistration(0, true)).toBe("");
    });
});
