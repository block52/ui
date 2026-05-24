import { findUserSeat } from "./playerSeatUtils";

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
