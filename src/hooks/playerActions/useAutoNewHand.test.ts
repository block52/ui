/**
 * Tests for useAutoNewHand (ui#635).
 *
 * The hook no longer broadcasts: it hands the new hand to the
 * ActionSubmitController so every tx from this account goes through one queue.
 * Its trigger still reads the LOGICAL track (getLatestGameState).
 */
import { renderHook, act } from "@testing-library/react";
import { NonPlayerActionType, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useAutoNewHand } from "./useAutoNewHand";
import { startNewHand } from "./startNewHand";
import { getLatestGameState } from "./transportAction";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";
import { AUTO_DEAL_DEFER_POLL_MS, MAX_AUTO_DEAL_DEFER_MS } from "../../bus/timing";

jest.mock("./startNewHand");
jest.mock("./transportAction");
// The hook re-runs its check on every committed bus item; `tick` stands in for
// one. (`mock`-prefixed so jest allows the factory to close over it.)
let mockTick = 0;
// ui#873: whether the bus is still showing a protected tournament run-out.
let mockSuspense = false;
jest.mock("../../context/gameState/GameEventsContext", () => ({
    useGameEventsContext: () => ({ latestItem: mockTick, isPlayingSuspense: () => mockSuspense })
}));

const mockStartNewHand = startNewHand as jest.MockedFunction<typeof startNewHand>;
const mockLatest = getLatestGameState as jest.MockedFunction<typeof getLatestGameState>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;
const ME = "b521me";

/** A logical-track snapshot where seat 1 (us) may or may not hold NEW_HAND. */
function snapshot(hasNewHand: boolean, nextToAct = 1): TexasHoldemStateDTO {
    return {
        nextToAct,
        players: [{ address: ME, seat: 1, legalActions: hasNewHand ? [{ action: NonPlayerActionType.NEW_HAND }] : [] }]
    } as unknown as TexasHoldemStateDTO;
}

/** A new frame arrives on the logical track. */
function frame(next: TexasHoldemStateDTO): void {
    mockLatest.mockReturnValue(next);
    mockTick++;
}

const newHandError = (): SubmitError => ({ kind: "terminal", message: "rejected", actionName: "new-hand" });

describe("useAutoNewHand", () => {
    let submit: jest.Mock<void, [SubmitActionRequest]>;

    beforeEach(() => {
        submit = jest.fn();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, ME);
        mockStartNewHand.mockReset();
        mockStartNewHand.mockResolvedValue({ hash: "0xnew", gameId: TABLE_ID, action: "new-hand", amount: "0" } as never);
        mockLatest.mockReset();
        mockSuspense = false;
    });
    afterEach(() => localStorage.clear());

    it("does not fire when disabled, when NEW_HAND is not legal, or out of turn", () => {
        mockLatest.mockReturnValue(snapshot(true));
        renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, false));

        mockLatest.mockReturnValue(snapshot(false));
        renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

        mockLatest.mockReturnValue(snapshot(true, 2));
        renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

        expect(submit).not.toHaveBeenCalled();
    });

    it("submits the new hand through the controller and never broadcasts by itself", async () => {
        mockLatest.mockReturnValue(snapshot(true));
        const onNewHandSubmitted = jest.fn();
        const { result } = renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, onNewHandSubmitted, true));

        expect(submit).toHaveBeenCalledTimes(1);
        const request = submit.mock.calls[0][0];
        expect(request.actionName).toBe("new-hand");
        expect(mockStartNewHand).not.toHaveBeenCalled();
        expect(result.current.isDealingNewHand).toBe(true);

        await request.run();
        expect(mockStartNewHand).toHaveBeenCalledWith(TABLE_ID, NETWORK);
        request.onSuccess?.("0xnew");
        expect(onNewHandSubmitted).toHaveBeenCalledWith("0xnew");
    });

    it("drops the dealing indicator when the controller reports the new hand failed", () => {
        mockLatest.mockReturnValue(snapshot(true));
        const { result, rerender } = renderHook(({ lastError }) => useAutoNewHand(TABLE_ID, NETWORK, submit, lastError, undefined, true), {
            initialProps: { lastError: null as SubmitError | null }
        });
        expect(result.current.isDealingNewHand).toBe(true);

        rerender({ lastError: newHandError() });
        expect(result.current.isDealingNewHand).toBe(false);
    });

    it("ignores another action's error, and a stale new-hand error on a later hand", () => {
        mockLatest.mockReturnValue(snapshot(true));
        const stale = newHandError();
        const { result, rerender } = renderHook(({ lastError }) => useAutoNewHand(TABLE_ID, NETWORK, submit, lastError, undefined, true), {
            initialProps: { lastError: { kind: "terminal", message: "x", actionName: "fold" } as SubmitError | null }
        });
        expect(result.current.isDealingNewHand).toBe(true);

        // The failed deal clears the indicator...
        rerender({ lastError: stale });
        expect(result.current.isDealingNewHand).toBe(false);

        // ...the hand starts (NEW_HAND gone), then the next one ends. The
        // controller still holds the SAME error object: it must not clear again.
        frame(snapshot(false));
        act(() => rerender({ lastError: stale }));
        frame(snapshot(true));
        act(() => rerender({ lastError: stale }));

        expect(submit).toHaveBeenCalledTimes(2);
        expect(result.current.isDealingNewHand).toBe(true);
    });

    // ui#661: hand 7's showdown on c1001 never progressed — two screenshots ~30s
    // apart still on hand7/action6. A failed new-hand held the latch, and at a
    // showdown there is no other player to deal from, so the table simply stops.
    describe("recovery after a failed new-hand (ui#661)", () => {
        const fail = (kind: SubmitError["kind"]): SubmitError => ({ kind, message: "rejected", actionName: "new-hand" });

        it("looks again after a failure, without a refresh", () => {
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));
            expect(submit).toHaveBeenCalledTimes(1);

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(2);
            expect(submit.mock.calls[1][0].actionName).toBe("new-hand");
        });

        it("re-reads the logical track before re-submitting, so a hand that started meanwhile is not dealt twice", () => {
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));
            const firstRequest = submit.mock.calls[0][0];

            // the hand started anyway — NEW_HAND is gone from the logical track
            mockLatest.mockReturnValue(snapshot(false));
            act(() => firstRequest.onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("does not look again out of turn", () => {
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));
            const firstRequest = submit.mock.calls[0][0];

            mockLatest.mockReturnValue(snapshot(true, 2));
            act(() => firstRequest.onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("stops after one second look", () => {
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));
            act(() => submit.mock.calls[1][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(2);
        });

        it("does not look again when the table has moved past us", () => {
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("superseded")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("gives the next showdown its own allowance", () => {
            mockLatest.mockReturnValue(snapshot(true));
            const { rerender } = renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));
            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));
            expect(submit).toHaveBeenCalledTimes(2);

            // the hand starts, then the next one ends
            frame(snapshot(false));
            act(() => rerender());
            frame(snapshot(true));
            act(() => rerender());
            expect(submit).toHaveBeenCalledTimes(3);

            act(() => submit.mock.calls[2][0].onFailure!(fail("terminal")));
            expect(submit).toHaveBeenCalledTimes(4);
        });
    });

    // ui#873: dealing the next hand straight away piled its frames onto a
    // tournament all-in run-out and fast-forwarded it.
    describe("deferral while a tournament run-out is showing (ui#873)", () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("waits for the run-out, showing the dealing indicator, then deals", () => {
            mockSuspense = true;
            mockLatest.mockReturnValue(snapshot(true));
            const { result } = renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

            expect(submit).not.toHaveBeenCalled();
            expect(result.current.isDealingNewHand).toBe(true);

            act(() => {
                jest.advanceTimersByTime(AUTO_DEAL_DEFER_POLL_MS * 4);
            });
            expect(submit).not.toHaveBeenCalled();

            mockSuspense = false;
            act(() => {
                jest.advanceTimersByTime(AUTO_DEAL_DEFER_POLL_MS);
            });
            expect(submit).toHaveBeenCalledTimes(1);
            expect(submit.mock.calls[0][0].actionName).toBe("new-hand");
        });

        it("deals anyway once the cap passes, so a stuck render never stops the table", () => {
            mockSuspense = true;
            mockLatest.mockReturnValue(snapshot(true));
            renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));

            act(() => {
                jest.advanceTimersByTime(MAX_AUTO_DEAL_DEFER_MS - AUTO_DEAL_DEFER_POLL_MS);
            });
            expect(submit).not.toHaveBeenCalled();
            act(() => {
                jest.advanceTimersByTime(AUTO_DEAL_DEFER_POLL_MS * 2);
            });
            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("drops a deferred deal (and its indicator) when the opportunity goes away", () => {
            mockSuspense = true;
            mockLatest.mockReturnValue(snapshot(true));
            const { result, rerender } = renderHook(() => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, true));
            expect(result.current.isDealingNewHand).toBe(true);

            // Another player dealt meanwhile.
            frame(snapshot(false));
            act(() => rerender());
            mockSuspense = false;
            act(() => {
                jest.advanceTimersByTime(MAX_AUTO_DEAL_DEFER_MS);
            });

            expect(submit).not.toHaveBeenCalled();
            expect(result.current.isDealingNewHand).toBe(false);
        });

        it("drops the indicator when auto-new-hand is switched off while waiting", () => {
            mockSuspense = true;
            mockLatest.mockReturnValue(snapshot(true));
            const { result, rerender } = renderHook(({ enabled }) => useAutoNewHand(TABLE_ID, NETWORK, submit, null, undefined, enabled), {
                initialProps: { enabled: true }
            });
            expect(result.current.isDealingNewHand).toBe(true);

            rerender({ enabled: false });
            act(() => {
                jest.advanceTimersByTime(AUTO_DEAL_DEFER_POLL_MS);
            });

            expect(submit).not.toHaveBeenCalled();
            expect(result.current.isDealingNewHand).toBe(false);
        });
    });
});
