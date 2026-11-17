import { winAmountFloatText } from "./winAmountFloat";

describe("winAmountFloatText (ui#861)", () => {
    it("shows cash wins in dollars", () => {
        expect(winAmountFloatText("0.04", false)).toBe("+$0.04");
        expect(winAmountFloatText("1,250.00", false)).toBe("+$1,250.00");
    });

    it("keeps chip wins as chips at SNG/tournament tables", () => {
        expect(winAmountFloatText("1,240 chips", true)).toBe("+1,240 chips");
    });

    it("is null when there is no amount", () => {
        expect(winAmountFloatText(null, false)).toBeNull();
        expect(winAmountFloatText(undefined, false)).toBeNull();
        expect(winAmountFloatText("", true)).toBeNull();
    });
});
