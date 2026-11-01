/**
 * useTournamentFinishMoment (ui#874): a live finish holds the results modal
 * through the deciding hand and the tournament-winner moment.
 */
import { renderHook, act } from "@testing-library/react";
import type { ResultDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useTournamentFinishMoment } from "./useTournamentFinishMoment";
import type { GameStreamItem } from "../../bus/types";
import { FINISH_SHOWDOWN_HOLD_MS, TOURNAMENT_WINNER_MOMENT_MS } from "../../bus/timing";

let mockItem: GameStreamItem | null = null;
jest.mock("../../context/gameState/GameEventsContext", () => ({
    useGameEventsContext: () => ({ latestItem: mockItem })
}));

let seq = 0;
function commit(results: ResultDTO[], format = "sit-and-go"): void {
    const snapshot = {
        players: [
            { address: "b521a", seat: 1 },
            { address: "b521b", seat: 2 }
        ],
        results,
        winners: [{ address: "b521a", description: "Flush, Ace high" }]
    } as unknown as TexasHoldemStateDTO;
    seq += 1;
    mockItem = { seq, classified: { kind: "state", snapshot, format } } as unknown as GameStreamItem;
}

const FINAL: ResultDTO[] = [
    { place: 2, playerId: "b521b", payout: "300" },
    { place: 1, playerId: "b521a", payout: "700" }
];

describe("useTournamentFinishMoment", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockItem = null;
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("walks a live final through showdown → winner → done", () => {
        commit([]);
        const { result, rerender } = renderHook(() => useTournamentFinishMoment());
        expect(result.current.phase).toBeNull();

        commit(FINAL);
        rerender();
        expect(result.current.phase).toBe("showdown");

        act(() => {
            jest.advanceTimersByTime(FINISH_SHOWDOWN_HOLD_MS);
        });
        expect(result.current.phase).toBe("winner");
        expect(result.current.finish?.winner.seat).toBe(1);
        expect(result.current.finish?.winningHand).toBe("Flush, Ace high");

        act(() => {
            jest.advanceTimersByTime(TOURNAMENT_WINNER_MOMENT_MS);
        });
        expect(result.current.phase).toBe("done");
    });

    it("holds a mid-tournament bust-out for the deciding hand only", () => {
        commit([]);
        const { result, rerender } = renderHook(() => useTournamentFinishMoment());
        commit([{ place: 3, playerId: "b521c", payout: "0" }]);
        rerender();
        expect(result.current.phase).toBe("showdown");
        act(() => {
            jest.advanceTimersByTime(FINISH_SHOWDOWN_HOLD_MS);
        });
        expect(result.current.phase).toBe("done");
    });

    it("does not hold a table opened after the finish", () => {
        commit(FINAL);
        const { result } = renderHook(() => useTournamentFinishMoment());
        expect(result.current.phase).toBeNull();
    });

    it("ignores cash tables", () => {
        commit([], "cash");
        const { result, rerender } = renderHook(() => useTournamentFinishMoment());
        commit(FINAL, "cash");
        rerender();
        expect(result.current.phase).toBeNull();
    });
});
