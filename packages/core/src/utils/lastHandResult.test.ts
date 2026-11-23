import { getLastHandResult, resetLastHandResult, setLastHandResult, subscribeLastHandResult } from "./lastHandResult";

describe("lastHandResult store", () => {
    afterEach(() => {
        resetLastHandResult();
    });

    it("stores and returns the latest result", () => {
        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["Seat 3 won with Two Pair — $0.40"] });
        expect(getLastHandResult()).toEqual({ tableId: "t1", handNumber: 7, lines: ["Seat 3 won with Two Pair — $0.40"] });
    });

    it("notifies subscribers on change and supports unsubscribe", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeLastHandResult(listener);

        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["a"] });
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        setLastHandResult({ tableId: "t1", handNumber: 8, lines: ["b"] });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("drops identical re-captures without notifying (per-frame effect safety)", () => {
        const listener = jest.fn();
        subscribeLastHandResult(listener);

        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["a", "b"] });
        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["a", "b"] });
        expect(listener).toHaveBeenCalledTimes(1);
        // Snapshot identity is stable across the dropped write (useSyncExternalStore contract).
        const first = getLastHandResult();
        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["a", "b"] });
        expect(getLastHandResult()).toBe(first);
    });

    it("replaces the result when the hand advances", () => {
        setLastHandResult({ tableId: "t1", handNumber: 7, lines: ["a"] });
        setLastHandResult({ tableId: "t1", handNumber: 8, lines: ["c"] });
        expect(getLastHandResult()?.handNumber).toBe(8);
    });
});
