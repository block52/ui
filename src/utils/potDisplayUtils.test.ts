import { GameFormat } from "@block52/poker-vm-sdk";
import { formatPotDisplay, formatChipCount } from "./potDisplayUtils";

describe("formatChipCount", () => {
    it("formats with comma separators", () => {
        expect(formatChipCount(1500)).toBe("1,500");
        expect(formatChipCount(10000)).toBe("10,000");
        expect(formatChipCount(100)).toBe("100");
    });
});

describe("formatPotDisplay", () => {
    describe("cash games", () => {
        it("formats pots as USDC dollars", () => {
            const result = formatPotDisplay(["1500000"], "3000000", GameFormat.CASH);
            expect(result.mainPot).toBe("1.50");
            expect(result.totalPot).toBe("3.00");
            expect(result.isTournamentStyle).toBe(false);
        });

        it("returns 0.00 for empty pots", () => {
            const result = formatPotDisplay([], undefined, GameFormat.CASH);
            expect(result.mainPot).toBe("0.00");
            expect(result.totalPot).toBe("0.00");
        });

        it("falls back totalPot to mainPot when totalPot is undefined", () => {
            const result = formatPotDisplay(["5000000"], undefined, GameFormat.CASH);
            expect(result.totalPot).toBe("5.00");
            expect(result.mainPot).toBe("5.00");
        });
    });

    describe("tournaments", () => {
        it("formats pots as chip counts with commas", () => {
            const result = formatPotDisplay(["1500"], "3000", GameFormat.TOURNAMENT);
            expect(result.mainPot).toBe("1,500");
            expect(result.totalPot).toBe("3,000");
            expect(result.isTournamentStyle).toBe(true);
        });

        it("returns 0 for empty pots", () => {
            const result = formatPotDisplay([], undefined, GameFormat.TOURNAMENT);
            expect(result.mainPot).toBe("0");
            expect(result.totalPot).toBe("0");
        });
    });

    describe("sit-and-go", () => {
        it("uses tournament-style formatting", () => {
            const result = formatPotDisplay(["500"], "1000", GameFormat.SIT_AND_GO);
            expect(result.mainPot).toBe("500");
            expect(result.totalPot).toBe("1,000");
            expect(result.isTournamentStyle).toBe(true);
        });
    });

    describe("multiple pots", () => {
        it("uses first pot as main pot", () => {
            const result = formatPotDisplay(["2000000", "500000"], "3000000", GameFormat.CASH);
            expect(result.mainPot).toBe("2.00");
            expect(result.totalPot).toBe("3.00");
        });
    });
});
