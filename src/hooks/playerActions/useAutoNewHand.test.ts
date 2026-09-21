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

jest.mock("./startNewHand");
jest.mock("./transportAction");
// The hook re-runs its check on every committed bus item; `tick` stands in for
// one. (`mock`-prefixed so jest allows the factory to close over it.)
let mockTick = 0;
jest.mock("../../context/gameState/GameEventsContext", () => ({
    useGameEventsContext: () => ({ latestItem: mockTick })
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
});
