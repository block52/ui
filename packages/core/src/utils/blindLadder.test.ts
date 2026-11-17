import { expandBlindLevel } from "@block52/poker-vm-sdk";
import { LADDER_LEVEL_COUNT, ladderBigBlindsAbove, ladderStructure } from "./blindLadder";

describe("blind ladder (ui#905)", () => {
    it("steps 20, 40, 60, 80, then 1, 1.5, 2, 3, 4, 6, 8 every power of ten", () => {
        expect(ladderBigBlindsAbove(0, 20)).toEqual([
            20, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000, 15000
        ]);
    });

    it("starts above the given big blind, including one that is not on the ladder", () => {
        expect(ladderBigBlindsAbove(20, 3)).toEqual([40, 60, 80]);
        expect(ladderBigBlindsAbove(50, 3)).toEqual([60, 80, 100]);
        expect(ladderBigBlindsAbove(100, 3)).toEqual([150, 200, 300]);
    });

    it("builds a table structure: the opening blinds, then the ladder, SB = BB / 2, no ante", () => {
        const s = ladderStructure(10, 20, 10);
        expect(s.levels).toHaveLength(LADDER_LEVEL_COUNT);
        expect(s.levels.slice(0, 8).map(l => `${l.smallBlind}/${l.bigBlind}`)).toEqual([
            "10/20", "20/40", "30/60", "40/80", "50/100", "75/150", "100/200", "150/300"
        ]);
        s.levels.forEach((l, i) => {
            expect(l.level).toBe(i);
            expect(Number(l.bigBlind)).toBe(2 * Number(l.smallBlind));
            expect(l).toMatchObject({ ante: "0", durationMinutes: 10, isBreak: false });
            if (i > 0) expect(Number(l.bigBlind)).toBeGreaterThan(Number(s.levels[i - 1].bigBlind));
        });
    });

    it("keeps opening blinds that are off the ladder, then joins it", () => {
        const s = ladderStructure(25, 50, 5);
        expect(s.levels.slice(0, 3).map(l => `${l.smallBlind}/${l.bigBlind}`)).toEqual(["25/50", "30/60", "40/80"]);
    });

    it("expands through the SDK as the engine plays it, repeating the last row past the end", () => {
        const s = ladderStructure(10, 20, 10);
        expect(expandBlindLevel(s, 5)).toMatchObject({ smallBlind: "75", bigBlind: "150", ante: "0", durationMinutes: 10 });
        const last = expandBlindLevel(s, LADDER_LEVEL_COUNT - 1);
        expect(expandBlindLevel(s, LADDER_LEVEL_COUNT + 5)).toMatchObject({ smallBlind: last.smallBlind, bigBlind: last.bigBlind });
    });
});
