import { renderHook } from "@testing-library/react";
import { GameFormat, type ResultDTO, type WinnerDTO, type PlayerDTO, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useSitAndGoPlayerResults } from "./useSitAndGoPlayerResults";

// Mock the context provider so the hook reads our stubbed game state.
const mockUseGameStateContext = jest.fn();
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => mockUseGameStateContext(),
}));

// Minimal helpers to build the shapes the hook reads.
const player = (seat: number, address: string): PlayerDTO =>
    ({ seat, address } as PlayerDTO);

const winner = (address: string, amount = "100"): WinnerDTO =>
    ({ address, amount } as WinnerDTO);

const result = (place: number, playerId: string, payout = "0"): ResultDTO =>
    ({ place, playerId, payout } as ResultDTO);

const setGameState = (overrides: Partial<TexasHoldemStateDTO>) => {
    mockUseGameStateContext.mockReturnValue({
        gameState: {
            players: [],
            winners: [],
            results: [],
            ...overrides,
        } as TexasHoldemStateDTO,
        gameFormat: GameFormat.SIT_AND_GO,
    });
};

beforeEach(() => {
    mockUseGameStateContext.mockReset();
});

describe("useSitAndGoPlayerResults", () => {
    describe("getPlayerResult — REGRESSION: hand winner is not 1st place", () => {
        // The bug: when a player wins a hand mid-tournament, the chain
        // populates gameState.winners with their address (per-hand winner).
        // gameState.results is only populated when the TOURNAMENT ends.
        // The old fallback "winner in winners but not in results → place: 1"
        // was wrong: hand winners get marked as tournament first-place
        // overlays even when the tournament hasn't ended.
        // Fix: getPlayerResult ONLY returns data from results[], never
        // synthesizes a place from winners[].

        it("returns null when player won the current hand but tournament has no results yet", () => {
            setGameState({
                players: [player(1, "alice"), player(2, "bob")],
                winners: [winner("bob", "200")],
                results: [],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getPlayerResult("bob")).toBeNull();
        });

        it("returns null for a hand winner not in tournament results, even when results is partially populated", () => {
            // Edge case: results has some entries but the hand-winner ("bob")
            // isn't among them. The buggy fallback used to return
            // { place: 1 } here; correct behaviour is null.
            setGameState({
                players: [player(1, "alice"), player(2, "bob"), player(3, "carol")],
                winners: [winner("bob", "200")],
                results: [result(3, "carol"), result(2, "alice")],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getPlayerResult("bob")).toBeNull();
        });
    });

    describe("getPlayerResult — happy paths", () => {
        it("returns the result entry when the player is in tournament results", () => {
            setGameState({
                players: [player(1, "alice"), player(2, "bob")],
                winners: [winner("alice", "400")],
                results: [result(1, "alice", "400"), result(2, "bob", "0")],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getPlayerResult("alice")).toEqual({
                place: 1,
                payout: "400",
                isWinner: true,
            });
            expect(hookResult.current.getPlayerResult("bob")).toEqual({
                place: 2,
                payout: "0",
                isWinner: false,
            });
        });

        it("returns null when the address has no result entry and no winner record", () => {
            setGameState({
                players: [player(1, "alice")],
                winners: [],
                results: [],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getPlayerResult("alice")).toBeNull();
        });
    });

    describe("getSeatResult", () => {
        it("returns the result for the address sitting at the seat", () => {
            setGameState({
                players: [player(1, "alice"), player(2, "bob")],
                winners: [winner("alice", "400")],
                results: [result(1, "alice", "400"), result(2, "bob", "0")],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getSeatResult(1)?.place).toBe(1);
            expect(hookResult.current.getSeatResult(2)?.place).toBe(2);
        });

        it("returns null for a hand winner mid-tournament (no overlay leakage)", () => {
            // Same scenario as the regression test above, but accessed via
            // the seat-keyed API that Player.tsx / OppositePlayer.tsx use.
            setGameState({
                players: [player(1, "alice"), player(2, "bob")],
                winners: [winner("bob", "200")],
                results: [],
            });
            const { result: hookResult } = renderHook(() => useSitAndGoPlayerResults());

            expect(hookResult.current.getSeatResult(2)).toBeNull();
        });
    });
});
