/**
 * Tests for useWinnerCards, exercised through the REAL useWinnerInfo.
 *
 * This chain is why useWinnerInfo's memoization matters. useWinnerCards memoizes
 * on `winnerInfo`; while that was a fresh array every render, this memo never
 * hit, so it produced a new Set every time -- and `winnerCards` is a dependency
 * of TableBoard's `communityCardsElements` memo, so the five community-card
 * elements were rebuilt on every single render.
 */
import { renderHook } from "@testing-library/react";
import { useWinnerCards } from "./useWinnerCards";
import { useGameStateContext } from "../../context/GameStateContext";

jest.mock("../../context/GameStateContext");

const mockedContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

/** A fresh snapshot object each call, as every WS frame produces. */
function withWinners(winners: unknown[], extra: Record<string, unknown> = {}) {
    mockedContext.mockReturnValue({
        gameState: {
            winners: winners.map(w => ({ ...(w as object) })),
            players: [{ seat: 1, address: "0xa" }],
            ...extra
        },
        isLoading: false,
        error: null
    } as any);
}

const WINNER = { seat: 1, address: "0xa", amount: "100", cards: ["AS", "KH"], description: "Two Pair" };

describe("useWinnerCards", () => {
    afterEach(() => jest.clearAllMocks());

    it("collects the winning cards", () => {
        withWinners([WINNER]);
        const { result } = renderHook(() => useWinnerCards());

        expect(result.current.has("AS")).toBe(true);
        expect(result.current.has("KH")).toBe(true);
        expect(result.current.size).toBe(2);
    });

    it("merges cards across split-pot winners", () => {
        withWinners([WINNER, { seat: 2, address: "0xb", amount: "50", cards: ["AS", "QD"], description: "Two Pair" }]);
        const { result } = renderHook(() => useWinnerCards());

        // "AS" is shared by both hands and must not be double-counted.
        expect([...result.current].sort()).toEqual(["AS", "KH", "QD"]);
    });

    it("is empty when there is no winner", () => {
        withWinners([]);
        expect(renderHook(() => useWinnerCards()).result.current.size).toBe(0);
    });

    it("is empty when a winner carries no cards (uncontested win)", () => {
        withWinners([{ seat: 1, address: "0xa", amount: "100", description: "Fold" }]);
        expect(renderHook(() => useWinnerCards()).result.current.size).toBe(0);
    });

    describe("identity stability", () => {
        it("returns the same Set across frames that do not change the winners", () => {
            withWinners([WINNER]);
            const { result, rerender } = renderHook(() => useWinnerCards());
            const first = result.current;

            // Three more WS frames: new snapshot objects, same winners. Only the
            // pot moves, which winner rendering does not depend on.
            withWinners([WINNER], { totalPot: "1" });
            rerender();
            withWinners([WINNER], { totalPot: "2" });
            rerender();
            withWinners([WINNER], { totalPot: "3" });
            rerender();

            expect(result.current).toBe(first);
        });

        it("returns a new Set when the winners actually change", () => {
            withWinners([WINNER]);
            const { result, rerender } = renderHook(() => useWinnerCards());
            const first = result.current;

            withWinners([{ ...WINNER, cards: ["2C", "3D"] }]);
            rerender();

            expect(result.current).not.toBe(first);
            expect([...result.current].sort()).toEqual(["2C", "3D"]);
        });
    });
});
