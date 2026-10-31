/**
 * usePlayerTimer (ui#644).
 *
 * #644 deleted a dead second implementation of auto-fold/auto-check that lived
 * in this hook and broadcast DIRECTLY, bypassing the submit queue. Its
 * acceptance asks that the hook's public surface be unchanged — there was no
 * test to hold that, so here it is.
 *
 * The point of these tests is the boundary, not the arithmetic: this hook
 * REPORTS time (including any time bank the chain granted, ui#19). It must
 * never act.
 */
import { renderHook, act } from "@testing-library/react";
import { NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
import { usePlayerTimer } from "./usePlayerTimer";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { hasValue } from "../../utils/guards";

const mockUseGameData = jest.fn();
const mockUseGameUI = jest.fn();
const mockUseReplay = jest.fn();
jest.mock("../../context/gameState/GameDataContext", () => ({
    useGameData: () => mockUseGameData()
}));
jest.mock("../../context/gameState/GameUIContext", () => ({
    useGameUI: () => mockUseGameUI()
}));
jest.mock("../../context/gameState/ReplayContext", () => ({
    useReplay: () => mockUseReplay()
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

const setState = (snapshot: unknown, isReplayMode = false) => {
    mockUseGameData.mockReturnValue({ gameState: snapshot, isOptimistic: false });
    mockUseGameUI.mockReturnValue({ isLoading: false, error: null });
    mockUseReplay.mockReturnValue({ isReplayMode, replayHandNumber: isReplayMode ? 9 : null, replayActionIndex: null });
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
                    hasUsedExtension: expect.any(Boolean),
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

        it("has no extension until the chain records a time bank", () => {
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.hasUsedExtension).toBe(false);
            expect(result.current.timeoutValue).toBe(30);
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

    // ui#19: the time bank is a chain action. The countdown grows only once
    // the engine has recorded it, and the grant doesn't restart the turn.
    describe("time bank from the chain (ui#19)", () => {
        const withTimeBank = (actionAgoMs: number, timeBankAgoMs: number | null) => {
            const now = Date.now();
            const snapshot = state();
            const previousActions: { action?: string; playerId?: string; timestamp: number }[] = [{ action: "call", playerId: "b521them", timestamp: now - actionAgoMs }];
            if (hasValue(timeBankAgoMs)) {
                previousActions.push({ action: NonPlayerActionType.TIME_BANK, playerId: ME, timestamp: now - timeBankAgoMs });
            }
            // our latest use granted 30s (the engine's per-player field)
            const players = snapshot.players.map(p => (p.seat === 1 ? { ...p, timeBankLastGrantMs: 30_000 } : p));
            return { ...snapshot, players, previousActions, gameOptions: { ...snapshot.gameOptions, timeBankMs: 45_000 } };
        };

        it("adds the granted time to the countdown", () => {
            setState(withTimeBank(25_000, 1_000));
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            // 30s turn + 30s bank, 25s gone since the turn began
            expect(result.current.timeRemaining).toBe(35);
            expect(result.current.timeoutValue).toBe(60);
            expect(result.current.hasUsedExtension).toBe(true);
        });

        it("counts from the turn's start, not from the time-bank action", () => {
            setState(withTimeBank(50_000, 30_000));
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.timeRemaining).toBe(10);
        });

        it("ignores a table time bank nobody has used this turn", () => {
            setState(withTimeBank(25_000, null));
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.timeRemaining).toBe(5);
            expect(result.current.hasUsedExtension).toBe(false);
        });
    });

    // ui#721: a hand replay is a frozen snapshot. The snapshot still carries a
    // nextToAct seat, but there is no live turn, so the timer must not run —
    // otherwise its per-second re-render flashes the "whose turn" indicator.
    describe("replay mode freezes the turn (ui#721)", () => {
        it("is inactive for the snapshot's next-to-act seat in replay", () => {
            setState(state(1), /* isReplayMode */ true);
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.isActive).toBe(false);
            expect(result.current.isCurrentUserTurn).toBe(false);
            expect(result.current.timeRemaining).toBe(0);
        });

        it("is active for that same seat when NOT in replay", () => {
            setState(state(1), /* isReplayMode */ false);
            const { result } = renderHook(() => usePlayerTimer(TABLE, 1));
            expect(result.current.isActive).toBe(true);
            expect(result.current.isCurrentUserTurn).toBe(true);
        });
    });
});
