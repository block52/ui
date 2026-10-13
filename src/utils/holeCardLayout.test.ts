import { holeCardLayout, HOLE_CARD_ROW_HEIGHT, winnerCardHighlight } from "./holeCardLayout";

describe("holeCardLayout (ui#768)", () => {
    it("keeps Hold'em's two cards at their original size with no overlap", () => {
        expect(holeCardLayout(2)).toEqual({ width: 60, height: 80, overlap: 0 });
    });

    it("fits Omaha's four cards inside the 160px seat", () => {
        const { width, height, overlap } = holeCardLayout(4);
        const gap = 4; // the row's gap-1
        expect(4 * width - 3 * overlap + 3 * gap).toBeLessThanOrEqual(160);
        expect(height).toBeLessThanOrEqual(HOLE_CARD_ROW_HEIGHT);
    });
});

describe("winnerCardHighlight", () => {
    const winning = new Set(["AH", "KH", "2H", "7H", "9H"]);

    it("lifts the winner's cards that made the hand and mutes the rest", () => {
        expect(["AH", "KH", "2C", "3D"].map(c => winnerCardHighlight(c, true, winning))).toEqual(["lift", "lift", "mute", "mute"]);
    });

    it("leaves a loser's cards and a hand without winning cards alone", () => {
        expect(winnerCardHighlight("AH", false, winning)).toBeUndefined();
        expect(winnerCardHighlight("AH", true, new Set())).toBeUndefined();
    });
});
