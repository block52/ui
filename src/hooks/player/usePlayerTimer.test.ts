/**
 * usePlayerTimer (ui#644).
 *
 * #644 deleted a dead second implementation of auto-fold/auto-check that lived
 * in this hook and broadcast DIRECTLY, bypassing the submit queue. Its
 * acceptance asks that the hook's public surface be unchanged — there was no
 * test to hold that, so here it is.
 *
 * The point of these tests is the boundary, not the arithmetic: this hook
 * REPORTS time and owns the one-per-turn extension. It must never act.
 */
import { renderHook, act } from "@testing-library/react";
import { PlayerStatus } from "@block52/poker-vm-sdk";
import { usePlayerTimer } from "./usePlayerTimer";
import { STORAGE_KEYS } from "../../constants/storageKeys";

const mockUseGameData = jest.fn();
const mockUseGameUI = jest.fn();
jest.mock("../../context/gameState/GameDataContext", () => ({
    useGameData: () => mockUseGameData()
}));
jest.mock("../../context/gameState/GameUIContext", () => ({
    useGameUI: () => mockUseGameUI()
}));

// The two direct broadcasters #644 removed. If the hook ever reaches for one
// again, these fail — that is the whole point of mocking them here.
const mockFold = jest.fn();
const mockCheck = jest.fn();
jest.mock("../playerActions/foldHand", () => ({ foldHand: (...a: unknown[]) => mockFold(...a) }));
jest.mock("../playerActions/checkHand", () => ({ checkHand: (...a: unknown[]) => mockCheck(...a) }));

const TABLE = "0xtable";
const ME = "b521me";

/** A snapshot where `nextToAct` is seat 1, which is us. */
const state = (nextToAct = 1, timeout = 30) => ({
    nextToAct,
    players: [
        { seat: 1, address: ME, status: PlayerStatus.ACTIVE },
        { seat: 2, address: "b521them", status: PlayerStatus.ACTIVE }
    ],
    previousActions: [{ timestamp: Date.now() }],
    // Full shape: validateGameOptions warns on a partial one and the noise
    // drowns the test output.
    gameOptions: {
        minBuyIn: "100000",
        maxBuyIn: "100000",
        minPlayers: 2,
        maxPlayers: 2,
        smallBlind: "100",
        bigBlind: "200",
        timeout
    }
});

const setState = (snapshot: unknown) => {
    mockUseGameData.mockReturnValue({ gameState: snapshot, isOptimistic: false });
    mockUseGameUI.mockReturnValue({ isLoading: false, error: null });
};

describe("usePlayerTimer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, ME);
        setState(state());
    });
    afterEach(() => localStorage.clear());

    describe("public surface (ui#644 — deletion must not change it)", () => {
        it("returns every field its four callers read", () => {
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));

            // Named individually rather than by snapshot: a missing key here is
            // a broken caller (PokerActionPanel, Player, OppositePlayer, ProgressBar).
            expect(result.current).toEqual(
                expect.objectContaining({
                    playerStatus: expect.anything(),
                    timeoutValue: expect.any(Number),
                    progress: expect.any(Number),
                    timeRemaining: expect.any(Number),
                    isActive: expect.any(Boolean),
                    extendTime: expect.any(Function),
                    hasUsedExtension: expect.any(Boolean),
                    canExtend: expect.any(Boolean),
                    isCurrentUser: expect.any(Boolean),
                    isCurrentUserTurn: expect.any(Boolean)
                })
            );
        });

        it("identifies the current user and whose turn it is", () => {
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.isCurrentUser).toBe(true);
            expect(result.current.isCurrentUserTurn).toBe(true);

            setState(state(2));
            const other = renderHook(() => usePlayerTimer(TABLE, 2));
            expect(other.result.current.isCurrentUser).toBe(false);
            expect(other.result.current.isCurrentUserTurn).toBe(false);
        });

        it("is inactive for a seat that is not to act", () => {
            setState(state(2));
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.isActive).toBe(false);
            expect(result.current.timeRemaining).toBe(0);
        });

        it("spends the time extension once per turn", () => {
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.hasUsedExtension).toBe(false);

            act(() => result.current.extendTime?.());

            const after = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(after.result.current.hasUsedExtension).toBe(true);
            expect(after.result.current.canExtend).toBe(false);
        });
    });

    // The reason #644 exists: this hook is mounted once per seat, so a direct
    // broadcaster here would have fired several times at once, outside the
    // controller's dedupe and serialization.
    describe("it reports time — it never acts (ui#644)", () => {
        it("never folds or checks, even at zero on our own turn", () => {
            jest.useFakeTimers();
            const stale = state();
            stale.previousActions = [{ timestamp: Date.now() - 120_000 }]; // long expired
            setState(stale);

            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            act(() => {
                jest.advanceTimersByTime(10_000);
            });

            expect(result.current.timeRemaining).toBe(0);
            expect(result.current.isCurrentUserTurn).toBe(true);
            expect(mockFold).not.toHaveBeenCalled();
            expect(mockCheck).not.toHaveBeenCalled();
            jest.useRealTimers();
        });

        it("stays silent across many mounted seats", () => {
            const seats = [1, 2].map(seat => renderHook(() => usePlayerTimer(TABLE, seat)));
            expect(seats).toHaveLength(2);
            expect(mockFold).not.toHaveBeenCalled();
            expect(mockCheck).not.toHaveBeenCalled();
        });
    });
});
