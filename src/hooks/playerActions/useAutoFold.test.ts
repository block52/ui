/**
 * Tests for useAutoFold (#605, #635).
 *
 *   1. It must still fire when the caller re-renders inside the 500ms settle
 *      window (#605) — now guaranteed by useLatchedDelay, pinned here end to end.
 *   2. `enabled` must be reactive.
 *   3. It submits through the ActionSubmitController and STANDS DOWN while that
 *      queue is busy (#635): the controller runs a queued job without re-checking
 *      the table, so a fold queued behind the player's own call could land on
 *      their next decision.
 */
import { renderHook, act } from "@testing-library/react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import { useAutoFold } from "./useAutoFold";
import { foldHand } from "./foldHand";
import { checkHand } from "./checkHand";
import { makeTestSubmit } from "./testSubmit";

jest.mock("./foldHand");
jest.mock("./checkHand");

const mockFold = foldHand as jest.MockedFunction<typeof foldHand>;
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
    hasFold?: boolean;
    hasCheck?: boolean;
    isUsersTurn?: boolean;
    timeRemaining?: number;
    isBusy?: boolean;
    enabled?: boolean;
}

describe("useAutoFold", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ hasFold = true, hasCheck = false, isUsersTurn = true, timeRemaining = 0, isBusy = false, enabled = true }: Props) =>
                useAutoFold(TABLE_ID, NETWORK, hasFold, hasCheck, isUsersTurn, timeRemaining, harness.submit, isBusy, onSubmitted, enabled),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        mockFold.mockReset();
        mockCheck.mockReset();
        mockFold.mockResolvedValue({ hash: "0xfold", gameId: TABLE_ID, action: "fold", amount: "0" } as never);
        mockCheck.mockResolvedValue({ hash: "0xcheck", gameId: TABLE_ID, action: "check", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("does not act while time remains", async () => {
            render({ timeRemaining: 5 });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not act when it is not the user's turn", async () => {
            render({ isUsersTurn: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not act when disabled", async () => {
            render({ enabled: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("does not act with neither FOLD nor CHECK legal", async () => {
            render({ hasFold: false, hasCheck: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });
    });

    describe("choice of action", () => {
        it("prefers a free CHECK over folding", async () => {
            render({ hasFold: true, hasCheck: true });
            await settle();
            expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
            expect(mockCheck).toHaveBeenCalledWith(TABLE_ID, NETWORK);
            expect(mockFold).not.toHaveBeenCalled();
            expect(onSubmitted).toHaveBeenCalledWith(PlayerActionType.CHECK, "0xcheck");
        });

        it("folds when checking is not available", async () => {
            render({ hasFold: true, hasCheck: false });
            await settle();
            expect(harness.requests.map(r => r.actionName)).toEqual(["fold"]);
            expect(mockFold).toHaveBeenCalledWith(TABLE_ID, NETWORK);
            expect(onSubmitted).toHaveBeenCalledWith(PlayerActionType.FOLD, "0xfold");
        });

        it("chooses at FIRE time: a check that became free inside the settle window wins", async () => {
            const { rerender } = render({ hasFold: true, hasCheck: false });
            act(() => jest.advanceTimersByTime(200));
            rerender({ hasFold: true, hasCheck: true });
            await settle();
            expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        });
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting: nothing runs until the controller runs it", async () => {
            const requests: Array<{ actionName: string }> = [];
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, request => requests.push(request), false, undefined, true));
            await settle();

            expect(requests.map(r => r.actionName)).toEqual(["fold"]);
            expect(mockFold).not.toHaveBeenCalled();
        });

        it("stands down while the player's own action is in flight — the clock running out is not a fold", async () => {
            const { rerender } = render({ isBusy: true });
            await settle();
            expect(harness.requests).toHaveLength(0);

            // Their call landed and the turn passed: still nothing.
            rerender({ isBusy: false, isUsersTurn: false });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("never queues behind an action that starts INSIDE the settle window", async () => {
            // Clock hits 0, auto-fold arms; 200ms later the player clicks Call.
            const { rerender } = render();
            act(() => jest.advanceTimersByTime(200));
            rerender({ isBusy: true });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });

        it("re-arms if that action was rejected and it is still the player's turn", async () => {
            const { rerender } = render({ isBusy: true });
            await settle();
            rerender({ isBusy: false });
            await settle();
            expect(harness.requests.map(r => r.actionName)).toEqual(["fold"]);
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still folds when the caller re-renders with a fresh callback every time", async () => {
            const { rerender } = renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, harness.submit, false, () => {}, true));

            // usePlayerTimer re-renders once a second while it is the player's
            // turn — exactly the window in which auto-fold is armed.
            act(() => jest.advanceTimersByTime(200));
            rerender();
            act(() => jest.advanceTimersByTime(100));
            rerender();
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
        });

        it("folds exactly once across many renders in the window", async () => {
            const { rerender } = renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, harness.submit, false, () => {}, true));
            for (let i = 0; i < 10; i++) {
                act(() => jest.advanceTimersByTime(20));
                rerender();
            }
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
        });
    });

    describe("reactive enabled", () => {
        it("acts when auto-fold is switched on after the clock already expired", async () => {
            const { rerender } = render({ enabled: false });
            await settle();
            expect(harness.requests).toHaveLength(0);

            rerender({ enabled: true });
            await settle();
            expect(harness.requests).toHaveLength(1);
        });

        it("stops acting when switched off before the clock expires", async () => {
            const { rerender } = render({ enabled: true, timeRemaining: 3 });
            rerender({ enabled: false, timeRemaining: 0 });
            await settle();
            expect(harness.requests).toHaveLength(0);
        });
    });

    describe("re-arming", () => {
        it("acts again on the next opportunity", async () => {
            const { rerender } = render();
            await settle();
            expect(harness.requests).toHaveLength(1);

            rerender({ isUsersTurn: false, timeRemaining: 30 });
            rerender({ isUsersTurn: true, timeRemaining: 0 });
            await settle();
            expect(harness.requests).toHaveLength(2);
        });

        it("does not act twice on one opportunity, even after a rejected submit", async () => {
            mockFold.mockRejectedValue(new Error("rejected"));
            const { rerender } = render();
            await settle();
            rerender({});
            await settle();
            expect(harness.requests).toHaveLength(1);
        });
    });
});
