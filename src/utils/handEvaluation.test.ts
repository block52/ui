import { GameVariant } from "@block52/poker-vm-sdk";
import { evaluateHand } from "./handEvaluation";

describe("evaluateHand (ui#768)", () => {
    describe("Omaha uses exactly two hole cards and three board cards", () => {
        it("four suited hole cards and two of the suit on the board are not a flush", () => {
            // Hold'em would see seven hearts' worth of flush; Omaha needs three on the board.
            const hand = evaluateHand(["AH", "KH", "QH", "JH"], ["2H", "3H", "9C", "8D", "4S"], GameVariant.OMAHA);
            expect(hand?.description).not.toMatch(/flush/i);
        });

        it("a one-card straight on board is not a straight", () => {
            // Board 9-T-J-Q + any king plays as a straight in Hold'em; Omaha must use two hole cards.
            const hand = evaluateHand(["KC", "2D", "3S", "7H"], ["9H", "TD", "JC", "QS", "2C"], GameVariant.OMAHA);
            expect(hand?.description).not.toMatch(/straight/i);
            expect(hand?.description).toMatch(/pair/i);
        });

        it("finds the flush when two hole cards and three board cards share a suit", () => {
            const hand = evaluateHand(["AH", "KH", "2C", "3D"], ["2H", "7H", "9H", "8D", "4S"], GameVariant.OMAHA);
            expect(hand?.description).toMatch(/flush/i);
            expect(hand?.hand).toHaveLength(5);
            expect(hand?.hand.filter(c => ["AH", "KH", "2C", "3D"].includes(c))).toHaveLength(2);
        });

        it("describes the best hole-card pair before the flop", () => {
            const hand = evaluateHand(["AS", "AD", "KC", "KH"], [], GameVariant.OMAHA);
            // Only two hole cards play, so AA-KK is aces, not two pair.
            expect(hand?.description).toBe("Pocket Aces");
        });
    });

    it("keeps Hold'em's best-five-of-seven", () => {
        const hand = evaluateHand(["KC", "2D"], ["9H", "TD", "JC", "QS", "2C"], GameVariant.TEXAS_HOLDEM);
        expect(hand?.description).toMatch(/straight/i);
    });

    it("returns null for masked or missing cards", () => {
        expect(evaluateHand(["X", "X", "X", "X"], [], GameVariant.OMAHA)).toBeNull();
        expect(evaluateHand(undefined, [], GameVariant.OMAHA)).toBeNull();
    });
});
