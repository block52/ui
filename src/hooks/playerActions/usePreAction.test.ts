/**
 * Tests for usePreAction (ui#388) — the CoinPoker-style pre-action bar firing hook.
 * It fires the armed pre-action on the rising edge of the player's turn, re-reads
 * legality + the call amount at fire time, submits through the controller, and
 * always resolves the intent (never waits behind an action the player made).
 */
import { renderHook, act } from "@testing-library/react";
import { usePreAction } from "./usePreAction";
import { checkHand } from "./checkHand";
import { foldHand } from "./foldHand";
import { callHand } from "./callHand";
import { makeTestSubmit } from "./testSubmit";
import { PreAction, PreActionCallGuard, PreActionLegal } from "../../utils/preActions";

jest.mock("./checkHand");
jest.mock("./foldHand");
jest.mock("./callHand");

const mockCheck = checkHand as jest.MockedFunction<typeof checkHand>;
const mockFold = foldHand as jest.MockedFunction<typeof foldHand>;
const mockCall = callHand as jest.MockedFunction<typeof callHand>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;
const CALL_MICRO = 3_000_000n;

async function settle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
    });
}

interface Props {
    action?: PreAction | null;
    legal?: PreActionLegal;
    callMicro?: bigint;
    isUsersTurn?: boolean;
    isBusy?: boolean;
    callGuard?: PreActionCallGuard;
}
const canCheck: PreActionLegal = { hasCheckAction: true, hasCallAction: false, hasFoldAction: true };
const facingBet: PreActionLegal = { hasCheckAction: false, hasCallAction: true, hasFoldAction: true };

describe("usePreAction", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onSubmitted = jest.fn();
    const onResolved = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ action = "check-fold", legal = canCheck, callMicro = CALL_MICRO, isUsersTurn = true, isBusy = false, callGuard }: Props) =>
                usePreAction(TABLE_ID, NETWORK, action, legal, callMicro, isUsersTurn, harness.submit, isBusy, onSubmitted, onResolved, callGuard),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        harness = makeTestSubmit();
        onSubmitted.mockReset();
        onResolved.mockReset();
        mockCheck.mockReset();
        mockCheck.mockResolvedValue({ hash: "0xcheck" } as never);
        mockFold.mockReset();
        mockFold.mockResolvedValue({ hash: "0xfold" } as never);
        mockCall.mockReset();
        mockCall.mockResolvedValue({ hash: "0xcall" } as never);
    });
    afterEach(() => jest.useRealTimers());

    it("does not fire when nothing is armed", async () => {
        render({ action: null });
        await settle();
        expect(harness.requests).toHaveLength(0);
        expect(onResolved).not.toHaveBeenCalled();
    });

    it("does not fire when it is not the user's turn", async () => {
        render({ isUsersTurn: false });
        await settle();
        expect(harness.requests).toHaveLength(0);
    });

    it("check-fold → CHECK when checking is free", async () => {
        render({ action: "check-fold", legal: canCheck });
        await settle();
        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("check-fold → FOLD when facing a bet", async () => {
        render({ action: "check-fold", legal: facingBet });
        await settle();
        expect(harness.requests.map(r => r.actionName)).toEqual(["fold"]);
    });

    it("check → CHECK, and does nothing if a bet has landed", async () => {
        render({ action: "check", legal: canCheck });
        await settle();
        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
    });

    it("check armed but facing a bet at fire time → resolves without acting", async () => {
        render({ action: "check", legal: facingBet });
        await settle();
        expect(harness.requests).toHaveLength(0);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it.each(["call-exact", "call-any"] as const)("%s → CALL the current amount when facing a bet", async action => {
        render({ action, legal: facingBet, callMicro: CALL_MICRO });
        await settle();
        expect(harness.requests.map(r => r.actionName)).toEqual(["call"]);
        expect(mockCall).toHaveBeenCalledWith(TABLE_ID, CALL_MICRO, NETWORK);
    });

    it("call-any with no bet → CHECK (never folds)", async () => {
        render({ action: "call-any", legal: canCheck });
        await settle();
        expect(harness.requests.map(r => r.actionName)).toEqual(["check"]);
        expect(mockFold).not.toHaveBeenCalled();
    });

    it("reads the FRESH call amount at fire time", async () => {
        const { rerender } = render({ action: "call-any", legal: facingBet, callMicro: CALL_MICRO });
        act(() => jest.advanceTimersByTime(200));
        rerender({ action: "call-any", legal: facingBet, callMicro: 9_000_000n });
        await settle();
        expect(mockCall).toHaveBeenCalledWith(TABLE_ID, 9_000_000n, NETWORK);
    });

    describe("Call {amount} only calls the amount it was armed at (ui#875)", () => {
        const RAISED_MICRO = 9_000_000n;

        it("calls when the bet is unchanged at the turn", async () => {
            render({ action: "call-exact", legal: facingBet, callMicro: CALL_MICRO, callGuard: { armedCallMicro: CALL_MICRO, owedMicro: CALL_MICRO } });
            await settle();
            expect(mockCall).toHaveBeenCalledWith(TABLE_ID, CALL_MICRO, NETWORK);
        });

        it("the reported bug: the raise and the turn arrive together; no call, intent cleared, normal turn", async () => {
            // Armed while waiting (not the user's turn) at 3.
            const { rerender } = render({
                action: "call-exact",
                legal: facingBet,
                isUsersTurn: false,
                callGuard: { armedCallMicro: CALL_MICRO, owedMicro: CALL_MICRO }
            });
            await settle();
            // One update: the raiser directly before us acts, so the bet is now 9 AND it is our turn.
            rerender({
                action: "call-exact",
                legal: facingBet,
                callMicro: RAISED_MICRO,
                isUsersTurn: true,
                callGuard: { armedCallMicro: CALL_MICRO, owedMicro: RAISED_MICRO }
            });
            await settle();
            expect(mockCall).not.toHaveBeenCalled();
            expect(harness.requests).toHaveLength(0);
            expect(onResolved).toHaveBeenCalledTimes(1);
        });

        it("a raise landing during the short delay before firing also stands it down", async () => {
            const { rerender } = render({ action: "call-exact", legal: facingBet, callGuard: { armedCallMicro: CALL_MICRO, owedMicro: CALL_MICRO } });
            act(() => jest.advanceTimersByTime(200));
            rerender({ action: "call-exact", legal: facingBet, callMicro: RAISED_MICRO, callGuard: { armedCallMicro: CALL_MICRO, owedMicro: RAISED_MICRO } });
            await settle();
            expect(mockCall).not.toHaveBeenCalled();
            expect(onResolved).toHaveBeenCalledTimes(1);
        });

        it("Call Any in the same situation still calls the raise", async () => {
            render({ action: "call-any", legal: facingBet, callMicro: RAISED_MICRO, callGuard: { armedCallMicro: null, owedMicro: RAISED_MICRO } });
            await settle();
            expect(mockCall).toHaveBeenCalledWith(TABLE_ID, RAISED_MICRO, NETWORK);
        });
    });

    it("resolves WITHOUT acting when the player already acted by hand (queue busy)", async () => {
        render({ action: "call-any", legal: facingBet, isBusy: true });
        await settle();
        expect(harness.requests).toHaveLength(0);
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("fires only once while the turn persists", async () => {
        const { rerender } = render({ action: "check-fold" });
        await settle();
        rerender({ action: "check-fold" });
        await settle();
        expect(harness.requests).toHaveLength(1);
    });
});
