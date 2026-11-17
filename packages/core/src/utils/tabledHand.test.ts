import { PlayerStatus } from "@block52/poker-vm-sdk";
import { isTabledHand } from "./tabledHand";

describe("isTabledHand (poker-vm#2758)", () => {
    it("is true for a SHOWING player", () => {
        expect(isTabledHand({ status: PlayerStatus.SHOWING })).toBe(true);
    });

    it("is true for a player who busted on the hand they showed down", () => {
        expect(isTabledHand({ status: PlayerStatus.BUSTED, cardsShown: true })).toBe(true);
        expect(isTabledHand({ status: PlayerStatus.SITTING_OUT, cardsShown: true })).toBe(true);
    });

    it("is false for a hand that was never tabled", () => {
        expect(isTabledHand({ status: PlayerStatus.FOLDED })).toBe(false);
        expect(isTabledHand({ status: PlayerStatus.MUCKED, cardsShown: false })).toBe(false);
        expect(isTabledHand({ status: PlayerStatus.ACTIVE })).toBe(false);
        expect(isTabledHand({ status: PlayerStatus.BUSTED })).toBe(false);
    });

    it("is false for no player", () => {
        expect(isTabledHand(null)).toBe(false);
        expect(isTabledHand(undefined)).toBe(false);
    });
});
