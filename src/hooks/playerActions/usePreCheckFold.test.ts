/**
 * Tests for usePreCheckFold (ui#388, #605, #635).
 *
 * Check/Fold checks when checking is free and folds when the player faces a bet
 * (CALL legal). It never folds a player who has not been bet into, e.g. on a
 * blind-posting turn where only fold-anytime is legal. It fires on the rising
 * edge of the turn, re-reads legality at fire time, always resolves the queued
 * intent, submits through the ActionSubmitController — and never waits in line
 * behind an action the player already made.
 */
import { renderHook, act } from "@testing-library/react";
import { usePreCheckFold } from "./usePreCheckFold";
import { checkHand } from "./checkHand";
import { foldHand } from "./foldHand";
import { makeTestSubmit } from "./testSubmit";

jest.mock("./checkHand");
jest.mock("./foldHand");

const mockCheck = checkHand as jest.MockedFunction<typeof checkHand>;
const mockFold = foldHand as jest.MockedFunction<typeof foldHand>;

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
    hasCall?: boolean;
    hasFold?: boolean;
    isUsersTurn?: boolean;
    isBusy?: boolean;
}

describe("usePreCheckFold", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();
    const onResolved = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ tableId = TABLE_ID, queued = true, hasCheck = true, hasCall = false, hasFold = true, isUsersTurn = true, isBusy = false }: Props) =>
                usePreCheckFold(tableId, NETWORK, queued, hasCheck, hasCall, hasFold, isUsersTurn, harness.submit, isBusy, onSubmitted, onResolved),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        onResolved.mockReset();
        mockCheck.mockReset();
        mockCheck.mockResolvedValue({ hash: "0xcheck", gameId: TABLE_ID, action: "check", amount: "0" } as never);
        mockFold.mockReset();
        mockFold.mockResolvedValue({ hash: "0xfold", gameId: TABLE_ID, action: "fold", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("re-renders during the settle window (#605)", () => {
        it("still fires when the caller re-renders with fresh callbacks every time", async () => {
            const { rerender } = renderHook(() =>
                usePreCheckFold(TABLE_ID, NETWORK, true, true, false, true, true, harness.submit, false, () => {}, () => {})
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

    it("submits CHECK once when queued and the turn arrives with CHECK still legal", async () => {
        render();
        await settle();

        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        expect(mockCheck).toHaveBeenCalledWith(TABLE_ID, NETWORK);
        expect(onSubmitted).toHaveBeenCalledWith("0xcheck");
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("submits FOLD once when someone bet before the turn arrived", async () => {
        render({ hasCheck: false, hasCall: true });
        await settle();

        expect(harness.requests.map(r => r.actionName)).toEqual(["fold"]);
        expect(mockFold).toHaveBeenCalledWith(TABLE_ID, NETWORK);
        expect(mockCheck).not.toHaveBeenCalled();
        expect(onSubmitted).toHaveBeenCalledWith("0xfold");
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("prefers CHECK whenever checking is free, even though FOLD is also legal", async () => {
        render({ hasCheck: true, hasCall: false, hasFold: true });
        await settle();

        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        expect(mockFold).not.toHaveBeenCalled();
    });

    it("never folds without a bet to fold to — e.g. a blind-posting turn with only fold-anytime legal", async () => {
        render({ hasCheck: false, hasCall: false, hasFold: true });
        await settle();

        expect(harness.requests).toHaveLength(0);
        expect(mockFold).not.toHaveBeenCalled();
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("resolves WITHOUT acting when facing a bet but FOLD is not legal", async () => {
        render({ hasCheck: false, hasCall: true, hasFold: false });
        await settle();

        expect(harness.requests).toHaveLength(0);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("reads the FRESH legality at fire time: a bet landing in the settle window folds", async () => {
        const { rerender } = render({ hasCheck: true });
        act(() => jest.advanceTimersByTime(200));
        rerender({ hasCheck: false, hasCall: true });
        await settle();

        expect(harness.requests.map(r => r.actionName)).toEqual(["fold"]);
    });

    it("reads the FRESH legality at fire time: CHECK disappearing with no bet resolves without acting", async () => {
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

    it("still resolves when the check submit is rejected", async () => {
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
            renderHook(() => usePreCheckFold(TABLE_ID, NETWORK, true, true, false, true, true, request => requests.push(request), false));
            await settle();

            expect(requests.map(r => r.actionName)).toEqual(["check"]);
            expect(mockCheck).not.toHaveBeenCalled();
        });

        it("resolves WITHOUT acting when the player already acted by hand — a late check lands on the wrong decision", async () => {
            render({ isBusy: true });
            await settle();

            expect(harness.requests).toHaveLength(0);
            expect(onResolved).toHaveBeenCalledTimes(1);
        });

        it("does not FOLD late either: facing a bet with the queue busy resolves without acting", async () => {
            render({ isBusy: true, hasCheck: false, hasCall: true });
            await settle();

            expect(harness.requests).toHaveLength(0);
            expect(mockFold).not.toHaveBeenCalled();
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
