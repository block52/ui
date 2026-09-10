/**
 * Equity-sharing tests for useAllInEquity.
 *
 * This hook is mounted once per SEAT, but the Monte Carlo it runs is GLOBAL —
 * the same hands and board give the same answer for every seat. These tests pin
 * the two properties that keep a 9-seat all-in from running nine (and, with
 * runout frame expansion, twenty-seven) identical 5000-iteration simulations on
 * the main thread:
 *
 *   1. concurrent instances share one simulation per (hands, board);
 *   2. the debounce is armed by the INPUT, not by object identity, so a WS frame
 *      that changes nothing relevant does not re-trigger it.
 */
import { renderHook, act } from "@testing-library/react";
import { useAllInEquity, resetEquityCache } from "./useAllInEquity";
import { useGameStateContext } from "../../context/GameStateContext";
import { useShowingCardsByAddress } from "./useShowingCardsByAddress";
import { PokerSolver } from "@block52/poker-vm-sdk";

jest.mock("../../context/GameStateContext");
jest.mock("./useShowingCardsByAddress");
jest.mock("@block52/poker-vm-sdk", () => {
    const actual = jest.requireActual("@block52/poker-vm-sdk");
    return {
        ...actual,
        Deck: { ...actual.Deck, fromString: (card: string) => card },
        PokerSolver: {
            ...actual.PokerSolver,
            calculateMultiPlayerEquity: jest.fn(() => ({ winPercentages: [60, 40] }))
        }
    };
});

const mockedContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;
const mockedShowing = useShowingCardsByAddress as jest.MockedFunction<typeof useShowingCardsByAddress>;
const mockedEquity = PokerSolver.calculateMultiPlayerEquity as jest.Mock;

/** Two revealed hands at showdown — the gate `useAllInEquity` opens on. */
function showdownState(board: string[]) {
    return {
        round: "showdown",
        communityCards: board,
        players: [
            { seat: 1, address: "0xa", status: "active", holeCards: ["AH", "AD"] },
            { seat: 2, address: "0xb", status: "active", holeCards: ["KS", "KC"] }
        ]
    };
}

function withState(state: unknown) {
    mockedContext.mockReturnValue({ gameState: state, isLoading: false, error: null } as any);
}

describe("useAllInEquity simulation sharing", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockedShowing.mockReturnValue({ showingPlayers: [] } as any);
        mockedEquity.mockClear();
        // The cache is shared across instances BY DESIGN, which means it is also
        // shared across test cases — clear it so each case starts cold.
        resetEquityCache();
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("runs ONE simulation for many seats on the same board", () => {
        withState(showdownState(["2H", "7D", "9S"]));

        // Nine seats mount the hook independently, as Player/OppositePlayer do.
        const seats = Array.from({ length: 9 }, () => renderHook(() => useAllInEquity()));
        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(mockedEquity).toHaveBeenCalledTimes(1);
        // Every seat still ends up with the result.
        for (const seat of seats) {
            expect(seat.result.current.equities.get(1)).toBe(60);
            expect(seat.result.current.equities.get(2)).toBe(40);
        }
    });

    it("does not re-simulate when a WS frame changes nothing relevant", () => {
        withState(showdownState(["2H", "7D", "9S"]));
        const { rerender } = renderHook(() => useAllInEquity());
        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(mockedEquity).toHaveBeenCalledTimes(1);

        // A fresh snapshot object with identical content — every WS frame is one
        // of these, and each used to re-arm the debounce in all nine instances.
        withState(showdownState(["2H", "7D", "9S"]));
        rerender();
        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(mockedEquity).toHaveBeenCalledTimes(1);
    });

    it("runs exactly one more simulation per street of a runout", () => {
        // Frame expansion now advances the board in three separate commits.
        withState(showdownState(["2H", "7D", "9S"]));
        const { rerender } = renderHook(() => useAllInEquity());
        act(() => {
            jest.advanceTimersByTime(300);
        });

        withState(showdownState(["2H", "7D", "9S", "JC"]));
        rerender();
        act(() => {
            jest.advanceTimersByTime(300);
        });

        withState(showdownState(["2H", "7D", "9S", "JC", "4D"]));
        rerender();
        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(mockedEquity).toHaveBeenCalledTimes(3);
    });

    it("clears equities when the showdown gate closes", () => {
        withState(showdownState(["2H", "7D", "9S"]));
        const { result, rerender } = renderHook(() => useAllInEquity());
        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(result.current.shouldShow).toBe(true);

        withState({ round: "preflop", communityCards: [], players: [] });
        rerender();

        expect(result.current.shouldShow).toBe(false);
        expect(result.current.equities.size).toBe(0);
    });
});
