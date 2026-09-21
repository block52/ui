/**
 * Tests for useAutoShowCards (#605, #635): clock-driven like useAutoFold, submits
 * through the ActionSubmitController, and stands down while that queue is busy.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoShowCards } from "./useAutoShowCards";
import { showCards } from "./showCards";
import { makeTestSubmit } from "./testSubmit";

jest.mock("./showCards");

const mockShow = showCards as jest.MockedFunction<typeof showCards>;

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
    hasShow?: boolean;
    isUsersTurn?: boolean;
    timeRemaining?: number;
    isBusy?: boolean;
}

describe("useAutoShowCards", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ hasShow = true, isUsersTurn = true, timeRemaining = 0, isBusy = false }: Props) =>
                useAutoShowCards(TABLE_ID, NETWORK, hasShow, isUsersTurn, timeRemaining, harness.submit, isBusy, onSubmitted),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        mockShow.mockReset();
        mockShow.mockResolvedValue({ hash: "0xshow", gameId: TABLE_ID, action: "show", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("does not fire when SHOW is not legal", async () => {
            render({ hasShow: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not fire when it is not the user's turn", async () => {
            render({ isUsersTurn: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not fire while time remains on the clock", async () => {
            render({ timeRemaining: 4 });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });
    });

    describe("firing", () => {
        it("submits SHOW once when the clock expires", async () => {
            render();
            await settle();

            expect(harness.requests.map(r => r.actionName)).toEqual(["show"]);
            expect(mockShow).toHaveBeenCalledWith(TABLE_ID, NETWORK);
            expect(onSubmitted).toHaveBeenCalledWith("0xshow");
        });

        it("a rejected submit does not wedge the hook — the next opportunity fires", async () => {
            mockShow.mockRejectedValueOnce(new Error("rejected"));
            const { rerender } = render();
            await settle();

            rerender({ isUsersTurn: false, timeRemaining: 30 });
            rerender({ isUsersTurn: true, timeRemaining: 0 });
            await settle();
            expect(harness.requests).toHaveLength(2);
        });
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting", async () => {
            const requests: Array<{ actionName: string }> = [];
            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, request => requests.push(request), false));
            await settle();

            expect(requests.map(r => r.actionName)).toEqual(["show"]);
            expect(mockShow).not.toHaveBeenCalled();
        });

        it("stands down while the queue is busy, and fires once it clears", async () => {
            const { rerender } = render({ isBusy: true });
            await settle();
            expect(harness.requests).toHaveLength(0);

            rerender({ isBusy: false });
            await settle();
            expect(harness.requests).toHaveLength(1);
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still submits when the caller re-renders with a fresh callback every time", async () => {
            const { rerender } = renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, harness.submit, false, () => {}));
            act(() => jest.advanceTimersByTime(200));
            rerender();
            act(() => jest.advanceTimersByTime(100));
            rerender();
            await settle();

            expect(mockShow).toHaveBeenCalledTimes(1);
        });

        it("does not submit twice when many renders land in the window", async () => {
            const { rerender } = renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, harness.submit, false, () => {}));
            for (let i = 0; i < 10; i++) {
                act(() => jest.advanceTimersByTime(20));
                rerender();
            }
            await settle();

            expect(mockShow).toHaveBeenCalledTimes(1);
        });
    });

    describe("re-arming", () => {
        it("fires again on the next opportunity", async () => {
            const { rerender } = render();
            await settle();
            rerender({ isUsersTurn: false, timeRemaining: 30 });
            rerender({ isUsersTurn: true, timeRemaining: 0 });
            await settle();

            expect(harness.requests).toHaveLength(2);
        });
    });
});
