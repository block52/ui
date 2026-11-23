import type { BlindStructureDTO } from "@block52/poker-vm-sdk";
import { directedBlinds, parseTournamentState, tournamentIdOf } from "./tournamentBlinds";

// Structure of a real tournament from the local 3-validator chain.
const CHAIN_STRUCTURE: BlindStructureDTO = {
    progression: "double",
    startSmallBlind: "25",
    startBigBlind: "50",
    durationMinutes: 5,
    ante: { startLevel: 4, bps: 1000 },
    roundBlinds: true
};

describe("directedBlinds", () => {
    it("gives the current and next level of a doubling structure", () => {
        const b = directedBlinds(CHAIN_STRUCTURE, 2);
        expect(b.current.smallBlind).toBe("100");
        expect(b.current.bigBlind).toBe("200");
        expect(b.next.smallBlind).toBe("200");
        expect(b.next.bigBlind).toBe("400");
        expect(b.levelDurationSeconds).toBe(300);
        expect(b.breakAhead).toBe(false);
    });

    it("applies the ante rule and big-blind rounding the engine applies", () => {
        const b = directedBlinds(CHAIN_STRUCTURE, 5); // 800/1600 -> next 1600/3200 rounds to 1600/3200
        expect(b.current.bigBlind).toBe("1600");
        expect(b.next.bigBlind).toBe("3200");
        expect(Number(b.current.ante)).toBeGreaterThan(0);
    });

    it("resolves a preset", () => {
        const b = directedBlinds({ preset: "turbo" }, 0);
        expect(b.current.smallBlind).toBe("25");
        expect(b.next.bigBlind).toBe("100");
        expect(b.levelDurationSeconds).toBe(300);
    });

    it("skips a break when naming the next playing level", () => {
        const table: BlindStructureDTO = {
            progression: "table",
            levels: [
                { level: 0, smallBlind: "25", bigBlind: "50", ante: "0", durationMinutes: 10, isBreak: false },
                { level: 1, smallBlind: "0", bigBlind: "0", ante: "0", durationMinutes: 5, isBreak: true },
                { level: 2, smallBlind: "50", bigBlind: "100", ante: "0", durationMinutes: 10, isBreak: false }
            ]
        };
        const b = directedBlinds(table, 0);
        expect(b.next.bigBlind).toBe("100");
        expect(b.breakAhead).toBe(true);
    });

    it("rejects a negative level", () => {
        expect(() => directedBlinds(CHAIN_STRUCTURE, -1)).toThrow();
    });
});

describe("tournamentIdOf", () => {
    it("reads the root tournamentId of a directed table", () => {
        expect(tournamentIdOf({ tournamentId: "0xabc", gameOptions: {} })).toBe("0xabc");
    });
    it("is undefined for an ordinary table", () => {
        expect(tournamentIdOf({ gameOptions: {} })).toBeUndefined();
        expect(tournamentIdOf(undefined)).toBeUndefined();
    });
});

describe("parseTournamentState", () => {
    const base = { tournamentId: "0xabc", status: "running", level: 2, options: { blindStructure: CHAIN_STRUCTURE }, entrants: [], tables: [] };

    it("parses a chain record", () => {
        expect(parseTournamentState(JSON.stringify(base)).level).toBe(2);
    });
    it("rejects a record missing the blind structure", () => {
        expect(() => parseTournamentState(JSON.stringify({ ...base, options: {} }))).toThrow("blindStructure");
    });
});
