import { findUserSeat, isSeatBigBlind } from "./playerSeatUtils";

describe("findUserSeat", () => {
    const gameState = {
        players: [
            { address: "b52aaa", seat: 1 },
            { address: "b52BBB", seat: 5 },
            { address: "b52ccc", seat: 9 }
        ]
    };

    it("returns the seat of the matching player (case-insensitive)", () => {
        expect(findUserSeat(gameState, "b52aaa")).toBe(1);
        expect(findUserSeat(gameState, "B52BBB")).toBe(5);
        expect(findUserSeat(gameState, "b52bbb")).toBe(5);
    });

    it("returns undefined when the address is not seated", () => {
        expect(findUserSeat(gameState, "b52ddd")).toBeUndefined();
    });

    it("returns undefined when the address is blank/null/undefined", () => {
        expect(findUserSeat(gameState, "")).toBeUndefined();
        expect(findUserSeat(gameState, null)).toBeUndefined();
        expect(findUserSeat(gameState, undefined)).toBeUndefined();
    });

    it("returns undefined when gameState or players is missing", () => {
        expect(findUserSeat(null, "b52aaa")).toBeUndefined();
        expect(findUserSeat(undefined, "b52aaa")).toBeUndefined();
        expect(findUserSeat({}, "b52aaa")).toBeUndefined();
    });
});

describe("isSeatBigBlind", () => {
    it("returns true when seat matches bigBlindPosition", () => {
        expect(isSeatBigBlind(3, 3)).toBe(true);
        expect(isSeatBigBlind(1, 1)).toBe(true);
        expect(isSeatBigBlind(9, 9)).toBe(true);
    });

    it("returns false when seat does not match bigBlindPosition", () => {
        expect(isSeatBigBlind(3, 4)).toBe(false);
        expect(isSeatBigBlind(5, 1)).toBe(false);
    });

    it("returns false when seat is undefined", () => {
        expect(isSeatBigBlind(undefined, 3)).toBe(false);
    });

    it("returns false when bigBlindPosition is undefined", () => {
        expect(isSeatBigBlind(3, undefined)).toBe(false);
    });

    it("returns false when both are undefined", () => {
        expect(isSeatBigBlind(undefined, undefined)).toBe(false);
    });

    it("treats seat 0 as not-seated (false even if bigBlindPosition is 0)", () => {
        expect(isSeatBigBlind(0, 0)).toBe(false);
        expect(isSeatBigBlind(0, 3)).toBe(false);
    });
});
