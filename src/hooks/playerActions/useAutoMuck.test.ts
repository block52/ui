/**
 * Tests for useAutoMuck (#605, #635).
 *
 * Differs from useAutoFold/useAutoShowCards in two ways worth pinning: its latch
 * reopens on the TURN ending rather than on the clock, and it defaults to
 * disabled. Like them it submits through the ActionSubmitController and stands
 * down while that queue is busy.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoMuck } from "./useAutoMuck";
import { muckCards } from "./muckCards";
import { makeTestSubmit } from "./testSubmit";

jest.mock("./muckCards");

const mockMuck = muckCards as jest.MockedFunction<typeof muckCards>;

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
    hasMuck?: boolean;
    isUsersTurn?: boolean;
    isBusy?: boolean;
    enabled?: boolean;
}

describe("useAutoMuck", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ hasMuck = true, isUsersTurn = true, isBusy = false, enabled = true }: Props) =>
                useAutoMuck(TABLE_ID, NETWORK, hasMuck, isUsersTurn, harness.submit, isBusy, onSubmitted, enabled),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        mockMuck.mockReset();
        mockMuck.mockResolvedValue({ hash: "0xmuck", gameId: TABLE_ID, action: "muck", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("is off unless explicitly enabled", async () => {
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true, harness.submit, false));
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not fire when MUCK is not legal", async () => {
            render({ hasMuck: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not fire when it is not the user's turn", async () => {
            render({ isUsersTurn: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });
    });

    describe("firing", () => {
        it("mucks once when enabled and it is the user's turn", async () => {
            render();
            await settle();

            expect(harness.requests.map(r => r.actionName)).toEqual(["muck"]);
            expect(mockMuck).toHaveBeenCalledWith(TABLE_ID, NETWORK);
            expect(onSubmitted).toHaveBeenCalledWith("0xmuck");
        });

        it("a rejected submit does not wedge the hook — the next showdown mucks", async () => {
            mockMuck.mockRejectedValueOnce(new Error("rejected"));
            const { rerender } = render();
            await settle();

            rerender({ isUsersTurn: false });
            rerender({ isUsersTurn: true });
            await settle();
            expect(harness.requests).toHaveLength(2);
        });
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting", async () => {
            const requests: Array<{ actionName: string }> = [];
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true, request => requests.push(request), false, undefined, true));
            await settle();

            expect(requests.map(r => r.actionName)).toEqual(["muck"]);
            expect(mockMuck).not.toHaveBeenCalled();
        });

        it("stands down while the queue is busy, and mucks once it clears", async () => {
            const { rerender } = render({ isBusy: true });
            await settle();
            expect(harness.requests).toHaveLength(0);

            rerender({ isBusy: false });
            await settle();
            expect(harness.requests).toHaveLength(1);
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still mucks when the caller re-renders with a fresh callback every time", async () => {
            const { rerender } = renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true, harness.submit, false, () => {}, true));
            act(() => jest.advanceTimersByTime(200));
            rerender();
            act(() => jest.advanceTimersByTime(100));
            rerender();
            await settle();

            expect(mockMuck).toHaveBeenCalledTimes(1);
        });
    });

    describe("reactive enabled", () => {
        it("mucks when switched on while the opportunity is already open", async () => {
            const { rerender } = render({ enabled: false });
            await settle();
            expect(harness.requests).toHaveLength(0);

            rerender({ enabled: true });
            await settle();
            expect(harness.requests).toHaveLength(1);
        });
    });

    describe("re-arming", () => {
        it("mucks again on the next hand's showdown", async () => {
            const { rerender } = render();
            await settle();
            rerender({ isUsersTurn: false });
            rerender({ isUsersTurn: true });
            await settle();

            expect(harness.requests).toHaveLength(2);
        });
    });
});
