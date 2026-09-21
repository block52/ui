/**
 * Tests for usePreCheck (ui#388 acceptance criteria, #605, #635).
 *
 * The pre-check can only ever CHECK. It fires on the rising edge of the turn,
 * re-reads legality at fire time, always resolves the queued intent, submits
 * through the ActionSubmitController — and never waits in line behind an action
 * the player already made.
 */
import { renderHook, act } from "@testing-library/react";
import { usePreCheck } from "./usePreCheck";
import { checkHand } from "./checkHand";
import { makeTestSubmit } from "./testSubmit";

jest.mock("./checkHand");

const mockCheck = checkHand as jest.MockedFunction<typeof checkHand>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;

async function settle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
    });
}

interface Props {
    tableId?: string;
    queued?: boolean;
    hasCheck?: boolean;
    isUsersTurn?: boolean;
    isBusy?: boolean;
}

describe("usePreCheck", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();
    const onResolved = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ tableId = TABLE_ID, queued = true, hasCheck = true, isUsersTurn = true, isBusy = false }: Props) =>
                usePreCheck(tableId, NETWORK, queued, hasCheck, isUsersTurn, harness.submit, isBusy, onSubmitted, onResolved),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        onResolved.mockReset();
        mockCheck.mockReset();
        mockCheck.mockResolvedValue({ hash: "0xcheck", gameId: TABLE_ID, action: "check", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("re-renders during the settle window (#605)", () => {
        it("still fires when the caller re-renders with fresh callbacks every time", async () => {
            const { rerender } = renderHook(() =>
                usePreCheck(TABLE_ID, NETWORK, true, true, true, harness.submit, false, () => {}, () => {})
            );
            act(() => jest.advanceTimersByTime(200));
            rerender();
            act(() => jest.advanceTimersByTime(100));
            rerender();
            await settle();

            expect(mockCheck).toHaveBeenCalledTimes(1);
        });

        it("resolves the queued state so the checkbox does not stay stuck", async () => {
            const { rerender } = render();
            act(() => jest.advanceTimersByTime(200));
            rerender({});
            await settle();

            expect(onResolved).toHaveBeenCalledTimes(1);
        });
    });

    it("does not fire when the pre-check is not queued", async () => {
        render({ queued: false });
        await settle();
        expect(harness.requests).toHaveLength(0);
        expect(onResolved).not.toHaveBeenCalled();
    });

    it("does not fire when it is not the user's turn", async () => {
        render({ isUsersTurn: false });
        await settle();
        expect(harness.requests).toHaveLength(0);
    });

    it("submits CHECK once when queued and the turn arrives with CHECK still legal (AC-2)", async () => {
        render();
        await settle();

        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        expect(mockCheck).toHaveBeenCalledWith(TABLE_ID, NETWORK);
        expect(onSubmitted).toHaveBeenCalledWith("0xcheck");
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("resolves WITHOUT acting when a bet slipped in so CHECK is no longer legal (AC-3/AC-5)", async () => {
        render({ hasCheck: false });
        await settle();

        expect(harness.requests).toHaveLength(0);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("reads the FRESH legality at fire time, not the value when the turn began (AC-5)", async () => {
        const { rerender } = render({ hasCheck: true });
        act(() => jest.advanceTimersByTime(200));
        rerender({ hasCheck: false });
        await settle();

        expect(harness.requests).toHaveLength(0);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("fires only once while the turn persists across re-renders", async () => {
        const { rerender } = render();
        await settle();
        rerender({});
        await settle();

        expect(harness.requests).toHaveLength(1);
    });

    it("re-arms after the turn passes and fires again on the next turn", async () => {
        const { rerender } = render();
        await settle();
        rerender({ isUsersTurn: false });
        rerender({ isUsersTurn: true });
        await settle();

        expect(harness.requests).toHaveLength(2);
    });

    it("still resolves when the check submit is rejected (AC-4 clear path)", async () => {
        mockCheck.mockRejectedValue(new Error("rejected"));
        render();
        await settle();

        expect(harness.requests).toHaveLength(1);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("does nothing when tableId is empty", async () => {
        render({ tableId: "" });
        await settle();

        expect(harness.requests).toHaveLength(0);
        expect(onResolved).not.toHaveBeenCalled();
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting", async () => {
            const requests: Array<{ actionName: string }> = [];
            renderHook(() => usePreCheck(TABLE_ID, NETWORK, true, true, true, request => requests.push(request), false));
            await settle();

            expect(requests.map(r => r.actionName)).toEqual(["check"]);
            expect(mockCheck).not.toHaveBeenCalled();
        });

        it("resolves WITHOUT checking when the player already acted by hand — a late check lands on the wrong decision", async () => {
            render({ isBusy: true });
            await settle();

            expect(harness.requests).toHaveLength(0);
            expect(onResolved).toHaveBeenCalledTimes(1);
        });

        it("does the same when the player acts INSIDE the settle window", async () => {
            const { rerender } = render({ isBusy: false });
            act(() => jest.advanceTimersByTime(200));
            rerender({ isBusy: true });
            await settle();

            expect(harness.requests).toHaveLength(0);
            expect(onResolved).toHaveBeenCalledTimes(1);
        });
    });
});
