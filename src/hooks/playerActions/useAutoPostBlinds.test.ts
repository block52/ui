/**
 * Tests for useAutoPostBlinds (ui#635).
 *
 * The hook no longer broadcasts: it hands the blind to the ActionSubmitController
 * so every tx from this account goes through one queue, and a rejection reaches
 * the player instead of dying in the console.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoPostBlinds } from "./useAutoPostBlinds";
import { postSmallBlind } from "./postSmallBlind";
import { postBigBlind } from "./postBigBlind";
import { ActionSubmitController } from "../../submit/ActionSubmitController";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";

jest.mock("./postSmallBlind");
jest.mock("./postBigBlind");

const mockSmall = postSmallBlind as jest.MockedFunction<typeof postSmallBlind>;
const mockBig = postBigBlind as jest.MockedFunction<typeof postBigBlind>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;
const SB = 100n;
const BB = 200n;

describe("useAutoPostBlinds", () => {
    let submit: jest.Mock<void, [SubmitActionRequest]>;

    beforeEach(() => {
        submit = jest.fn();
        mockSmall.mockReset();
        mockBig.mockReset();
        mockSmall.mockResolvedValue({ hash: "0xsb", gameId: TABLE_ID, action: "post-small-blind", amount: "100" } as never);
        mockBig.mockResolvedValue({ hash: "0xbb", gameId: TABLE_ID, action: "post-big-blind", amount: "200" } as never);
    });

    describe("gating", () => {
        it("does not fire when disabled", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, true, SB, BB, true, submit, undefined, false));
            expect(submit).not.toHaveBeenCalled();
        });

        it("does not fire when it is not the user's turn", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, true, SB, BB, false, submit, undefined, true));
            expect(submit).not.toHaveBeenCalled();
        });

        it("does not submit a zero blind", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, 0n, BB, true, submit, undefined, true));
            expect(submit).not.toHaveBeenCalled();
        });
    });

    describe("firing", () => {
        it("submits the small blind through the controller and never broadcasts by itself", async () => {
            const onBlindSubmitted = jest.fn();
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, SB, BB, true, submit, onBlindSubmitted, true));

            expect(submit).toHaveBeenCalledTimes(1);
            const request = submit.mock.calls[0][0];
            expect(request.actionName).toBe("small-blind");
            expect(mockSmall).not.toHaveBeenCalled();

            await request.run();
            expect(mockSmall).toHaveBeenCalledWith(TABLE_ID, SB, NETWORK);
            request.onSuccess?.("0xsb");
            expect(onBlindSubmitted).toHaveBeenCalledWith("small", "0xsb");
        });

        it("submits the big blind under its own action name", async () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, false, true, SB, BB, true, submit, undefined, true));

            const request = submit.mock.calls[0][0];
            expect(request.actionName).toBe("big-blind");
            await request.run();
            expect(mockBig).toHaveBeenCalledWith(TABLE_ID, BB, NETWORK);
        });

        it("fires once per opportunity and re-arms when the blind goes away", () => {
            const { rerender } = renderHook(
                ({ hasSb }) => useAutoPostBlinds(TABLE_ID, NETWORK, hasSb, false, SB, BB, true, submit, undefined, true),
                { initialProps: { hasSb: true } }
            );
            rerender({ hasSb: true });
            expect(submit).toHaveBeenCalledTimes(1);

            rerender({ hasSb: false });
            rerender({ hasSb: true });
            expect(submit).toHaveBeenCalledTimes(2);
        });
    });

    // ui#662: the latch used to be set BEFORE the trigger ran, and the trigger
    // returns without submitting when the amount or the table id has not arrived.
    // So a render carrying `0n` burned the one shot for the whole opportunity and
    // the blind never posted — the player was left with the manual button.
    describe("late inputs (ui#662)", () => {
        it("submits exactly once when the small blind amount arrives after the opportunity", () => {
            const { rerender } = renderHook(
                ({ amount }) => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, amount, BB, true, submit, undefined, true),
                { initialProps: { amount: 0n } }
            );
            expect(submit).not.toHaveBeenCalled();

            rerender({ amount: SB });
            expect(submit).toHaveBeenCalledTimes(1);
            expect(submit.mock.calls[0][0].actionName).toBe("small-blind");

            // the opportunity is now consumed — further renders must not re-submit
            rerender({ amount: SB });
            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("submits exactly once when the big blind amount arrives after the opportunity", () => {
            const { rerender } = renderHook(
                ({ amount }) => useAutoPostBlinds(TABLE_ID, NETWORK, false, true, SB, amount, true, submit, undefined, true),
                { initialProps: { amount: 0n } }
            );
            expect(submit).not.toHaveBeenCalled();

            rerender({ amount: BB });
            expect(submit).toHaveBeenCalledTimes(1);
            expect(submit.mock.calls[0][0].actionName).toBe("big-blind");

            rerender({ amount: BB });
            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("submits exactly once when the table id arrives after the opportunity", () => {
            const { rerender } = renderHook(
                ({ id }) => useAutoPostBlinds(id, NETWORK, true, false, SB, BB, true, submit, undefined, true),
                { initialProps: { id: "" } }
            );
            expect(submit).not.toHaveBeenCalled();

            rerender({ id: TABLE_ID });
            expect(submit).toHaveBeenCalledTimes(1);

            rerender({ id: TABLE_ID });
            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("still re-arms for the next hand after a late-input opportunity was served", () => {
            const { rerender } = renderHook(
                ({ hasSb, amount }) => useAutoPostBlinds(TABLE_ID, NETWORK, hasSb, false, amount, BB, true, submit, undefined, true),
                { initialProps: { hasSb: true, amount: 0n } }
            );
            rerender({ hasSb: true, amount: SB });
            expect(submit).toHaveBeenCalledTimes(1);

            rerender({ hasSb: false, amount: SB });
            rerender({ hasSb: true, amount: SB });
            expect(submit).toHaveBeenCalledTimes(2);
        });

        it("never submits while the amount stays zero for the whole opportunity", () => {
            const { rerender } = renderHook(
                ({ hasSb }) => useAutoPostBlinds(TABLE_ID, NETWORK, hasSb, false, 0n, BB, true, submit, undefined, true),
                { initialProps: { hasSb: true } }
            );
            rerender({ hasSb: true });
            rerender({ hasSb: false });
            expect(submit).not.toHaveBeenCalled();
        });
    });

    // ui#655: the c1001 session left "Post Small Blind 25" on screen over a pot
    // of 0, hand after hand. The auto-post HAD fired and been rejected — and the
    // latch survived the rejection, so the hook never looked again for the whole
    // opportunity. A manual click or a refresh was the only way on.
    describe("recovery after a rejected auto-post (ui#655)", () => {
        const fail = (kind: SubmitError["kind"], actionName = "small-blind"): SubmitError => ({
            kind,
            message: "rejected",
            actionName
        });

        it("looks again after a rejection, without a refresh", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, SB, BB, true, submit, undefined, true));
            expect(submit).toHaveBeenCalledTimes(1);

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(2);
            expect(submit.mock.calls[1][0].actionName).toBe("small-blind");
        });

        it("stops after one second look — two failures are evidence, not grounds for a third", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, SB, BB, true, submit, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));
            act(() => submit.mock.calls[1][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(2);
        });

        it("does not look again when the table has moved past us", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, true, false, SB, BB, true, submit, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("stale")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("does not look again once the opportunity is gone", () => {
            const { rerender } = renderHook(
                ({ hasSb }) => useAutoPostBlinds(TABLE_ID, NETWORK, hasSb, false, SB, BB, true, submit, undefined, true),
                { initialProps: { hasSb: true } }
            );
            const firstRequest = submit.mock.calls[0][0];

            rerender({ hasSb: false });
            act(() => firstRequest.onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("gives the NEXT hand its own full allowance", () => {
            const { rerender } = renderHook(
                ({ hasSb }) => useAutoPostBlinds(TABLE_ID, NETWORK, hasSb, false, SB, BB, true, submit, undefined, true),
                { initialProps: { hasSb: true } }
            );
            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));
            expect(submit).toHaveBeenCalledTimes(2);

            // opportunity ends, a new hand brings a new one
            rerender({ hasSb: false });
            rerender({ hasSb: true });
            expect(submit).toHaveBeenCalledTimes(3);

            act(() => submit.mock.calls[2][0].onFailure!(fail("terminal")));
            expect(submit).toHaveBeenCalledTimes(4);
        });

        it("recovers each blind independently", () => {
            renderHook(() => useAutoPostBlinds(TABLE_ID, NETWORK, false, true, SB, BB, true, submit, undefined, true));
            expect(submit.mock.calls[0][0].actionName).toBe("big-blind");

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal", "big-blind")));

            expect(submit).toHaveBeenCalledTimes(2);
            expect(submit.mock.calls[1][0].actionName).toBe("big-blind");
        });
    });

    // The regression itself: on 21 Sept 2026 a rejected auto-post ("account
    // sequence mismatch, expected 120, got 119") was only ever console.error'd,
    // so the player just saw a manual "Post Small Blind" button appear.
    describe("through a real ActionSubmitController", () => {
        it("surfaces a rejected auto-post to the player", async () => {
            const errors: SubmitError[] = [];
            const controller = new ActionSubmitController({
                getState: () => undefined,
                getLocalAddress: () => "b521player",
                onError: error => errors.push(error),
                clearSigningCache: () => {}
            });
            mockSmall.mockRejectedValue(new Error("account sequence mismatch, expected 120, got 119: incorrect account sequence"));

            renderHook(() =>
                useAutoPostBlinds(TABLE_ID, NETWORK, true, false, SB, BB, true, request => controller.submit(request), undefined, true)
            );
            await act(async () => {
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(mockSmall).toHaveBeenCalledTimes(1);
            expect(errors).toHaveLength(1);
            expect(errors[0].actionName).toBe("small-blind");
            controller.reset();
        });
    });
});
