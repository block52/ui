/**
 * Tests for useGameProgress.
 *
 * The hook had no memoization at all: a fresh `defaultState` object, a full
 * players `.filter()` and a fresh result object on every render of every
 * consumer, whether or not the game state had changed.
 */
import { renderHook } from "@testing-library/react";
import { useGameProgress } from "./useGameProgress";
import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";

jest.mock("../../context/GameStateContext");

const mockedContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

function withState(state: unknown, over: { isLoading?: boolean; error?: Error | null } = {}) {
    mockedContext.mockReturnValue({
        gameState: state,
        isLoading: over.isLoading ?? false,
        error: over.error ?? null
    } as any);
}

function player(seat: number, status: PlayerStatus) {
    return { seat, address: `0x${seat}`, status };
}

function stateWith(statuses: PlayerStatus[]) {
    return {
        players: statuses.map((s, i) => player(i + 1, s)),
        handNumber: 7,
        nextToAct: 2,
        previousActions: [{ index: 1 }, { index: 2 }],
        round: TexasHoldemRound.FLOP
    };
}

describe("useGameProgress", () => {
    afterEach(() => jest.clearAllMocks());

    describe("active-player filtering", () => {
        it("excludes folded, sitting-out and seated players", () => {
            withState(
                stateWith([
                    PlayerStatus.ACTIVE,
                    PlayerStatus.FOLDED,
                    PlayerStatus.SITTING_OUT,
                    PlayerStatus.SEATED,
                    PlayerStatus.ALL_IN
                ])
            );

            const { result } = renderHook(() => useGameProgress());

            expect(result.current.activePlayers.map(p => p.seat)).toEqual([1, 5]);
            expect(result.current.playerCount).toBe(2);
        });

        it("is in progress with two or more active players", () => {
            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.ACTIVE]));
            expect(renderHook(() => useGameProgress()).result.current.isGameInProgress).toBe(true);
        });

        it("is not in progress with one active player", () => {
            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.FOLDED]));
            expect(renderHook(() => useGameProgress()).result.current.isGameInProgress).toBe(false);
        });
    });

    describe("passthrough fields", () => {
        it("surfaces hand number, next to act and the action log", () => {
            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.ACTIVE]));
            const { result } = renderHook(() => useGameProgress());

            expect(result.current.handNumber).toBe(7);
            expect(result.current.nextToAct).toBe(2);
            expect(result.current.actionCount).toBe(2);
            expect(result.current.previousActions).toHaveLength(2);
        });
    });

    describe("loading and error", () => {
        it("returns the default state while loading", () => {
            withState(stateWith([PlayerStatus.ACTIVE]), { isLoading: true });
            const { result } = renderHook(() => useGameProgress());

            expect(result.current.isGameInProgress).toBe(false);
            expect(result.current.activePlayers).toEqual([]);
            expect(result.current.isLoading).toBe(true);
        });

        it("returns the default state on error", () => {
            withState(stateWith([PlayerStatus.ACTIVE]), { error: new Error("boom") });
            expect(renderHook(() => useGameProgress()).result.current.playerCount).toBe(0);
        });

        it("returns the default state with no game state", () => {
            withState(undefined);
            expect(renderHook(() => useGameProgress()).result.current.playerCount).toBe(0);
        });

        it("returns the default state when players is absent", () => {
            withState({ handNumber: 1 });
            expect(renderHook(() => useGameProgress()).result.current.activePlayers).toEqual([]);
        });
    });

    describe("recomputation", () => {
        it("keeps a stable identity when the snapshot has not changed", () => {
            // Renders driven by something other than a WS frame -- the blind-level
            // tick re-renders the whole Table tree once a second -- must not
            // re-filter the players or hand back a fresh object.
            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.ACTIVE]));
            const { result, rerender } = renderHook(() => useGameProgress());
            const first = result.current;

            rerender();
            rerender();

            expect(result.current).toBe(first);
            expect(result.current.activePlayers).toBe(first.activePlayers);
        });

        it("recomputes when a new snapshot arrives", () => {
            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.ACTIVE]));
            const { result, rerender } = renderHook(() => useGameProgress());
            const first = result.current;

            withState(stateWith([PlayerStatus.ACTIVE, PlayerStatus.FOLDED]));
            rerender();

            expect(result.current).not.toBe(first);
            expect(result.current.isGameInProgress).toBe(false);
        });
    });
});
