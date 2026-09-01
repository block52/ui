import { renderHook, act } from "@testing-library/react";
import { usePreCheck } from "./usePreCheck";
import { checkHand } from "./checkHand";

jest.mock("./checkHand");

const mockCheckHand = checkHand as jest.MockedFunction<typeof checkHand>;

// usePreCheck waits 500ms (mirroring useAutoFold's settle delay) before it reads
// legality and submits, so every fire path is driven through fake timers.
const TABLE_ID = "0xtable";
const NETWORK = {} as never;

/**
 * Advance past the hook's 500ms settle delay and flush the async submit so the
 * onResolved/onComplete callbacks have run before assertions.
 */
async function fireAndSettle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        // Let the awaited checkHand()/onComplete microtasks flush.
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("usePreCheck", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockCheckHand.mockReset();
        mockCheckHand.mockResolvedValue({ hash: "0xhash", gameId: TABLE_ID, action: "check", amount: "0" });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("does not fire when the pre-check is not queued", async () => {
        const onResolved = jest.fn();
        renderHook(() => usePreCheck(TABLE_ID, NETWORK, false, true, true, undefined, undefined, undefined, onResolved));
        await fireAndSettle();
        expect(mockCheckHand).not.toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
    });

    it("does not fire when it is not the user's turn", async () => {
        const onResolved = jest.fn();
        renderHook(() => usePreCheck(TABLE_ID, NETWORK, true, true, false, undefined, undefined, undefined, onResolved));
        await fireAndSettle();
        expect(mockCheckHand).not.toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
    });

    it("submits CHECK once when queued and the turn arrives with CHECK still legal (AC-2)", async () => {
        const onStarted = jest.fn();
        const onComplete = jest.fn();
        const onResolved = jest.fn();
        renderHook(() =>
            usePreCheck(TABLE_ID, NETWORK, true, true, true, onStarted, onComplete, undefined, onResolved)
        );
        await fireAndSettle();

        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(mockCheckHand).toHaveBeenCalledTimes(1);
        expect(mockCheckHand).toHaveBeenCalledWith(TABLE_ID, NETWORK);
        expect(onComplete).toHaveBeenCalledWith("0xhash");
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("resolves WITHOUT acting when a bet slipped in so CHECK is no longer legal (AC-3/AC-5)", async () => {
        const onStarted = jest.fn();
        const onResolved = jest.fn();
        renderHook(() =>
            usePreCheck(TABLE_ID, NETWORK, true, /* hasCheckAction */ false, true, onStarted, undefined, undefined, onResolved)
        );
        await fireAndSettle();

        expect(mockCheckHand).not.toHaveBeenCalled();
        expect(onStarted).not.toHaveBeenCalled();
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("reads the FRESH legality at fire time, not the value when the turn began (AC-5)", async () => {
        // Turn arrives with CHECK legal, but a bet lands during the 500ms settle
        // window and re-renders with hasCheckAction=false → must NOT submit.
        const onResolved = jest.fn();
        const { rerender } = renderHook(
            ({ hasCheck }: { hasCheck: boolean }) =>
                usePreCheck(TABLE_ID, NETWORK, true, hasCheck, true, undefined, undefined, undefined, onResolved),
            { initialProps: { hasCheck: true } }
        );

        // Bet lands before the settle timer elapses.
        rerender({ hasCheck: false });
        await fireAndSettle();

        expect(mockCheckHand).not.toHaveBeenCalled();
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("fires only once while the turn persists across re-renders", async () => {
        const onResolved = jest.fn();
        const { rerender } = renderHook(
            ({ turn }: { turn: boolean }) =>
                usePreCheck(TABLE_ID, NETWORK, true, true, turn, undefined, undefined, undefined, onResolved),
            { initialProps: { turn: true } }
        );
        await fireAndSettle();
        expect(mockCheckHand).toHaveBeenCalledTimes(1);

        rerender({ turn: true });
        await fireAndSettle();
        expect(mockCheckHand).toHaveBeenCalledTimes(1);
    });

    it("re-arms after the turn passes and fires again on the next turn", async () => {
        const onResolved = jest.fn();
        const { rerender } = renderHook(
            ({ turn }: { turn: boolean }) =>
                usePreCheck(TABLE_ID, NETWORK, true, true, turn, undefined, undefined, undefined, onResolved),
            { initialProps: { turn: true } }
        );
        await fireAndSettle();
        expect(mockCheckHand).toHaveBeenCalledTimes(1);

        // Turn passes → latch resets.
        rerender({ turn: false });
        await fireAndSettle();
        // Turn comes back around.
        rerender({ turn: true });
        await fireAndSettle();

        expect(mockCheckHand).toHaveBeenCalledTimes(2);
    });

    it("still resolves when the check submit throws (AC-4 clear path)", async () => {
        const onError = jest.fn();
        const onResolved = jest.fn();
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        mockCheckHand.mockRejectedValueOnce(new Error("broadcast failed"));
        renderHook(() =>
            usePreCheck(TABLE_ID, NETWORK, true, true, true, undefined, undefined, onError, onResolved)
        );
        await fireAndSettle();

        expect(mockCheckHand).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onResolved).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });

    it("does nothing when tableId is empty", async () => {
        const onResolved = jest.fn();
        renderHook(() => usePreCheck("", NETWORK, true, true, true, undefined, undefined, undefined, onResolved));
        await fireAndSettle();
        expect(mockCheckHand).not.toHaveBeenCalled();
        // The fire() early-returns on empty tableId before onResolved.
        expect(onResolved).not.toHaveBeenCalled();
    });
});
