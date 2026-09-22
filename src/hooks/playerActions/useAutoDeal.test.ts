/**
 * Tests for useAutoDeal (ui#635).
 *
 * The hook no longer broadcasts: it hands the deal to the ActionSubmitController
 * so every tx from this account goes through one queue.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoDeal } from "./useAutoDeal";
import { dealCardsWithEntropy } from "./dealCards";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";

jest.mock("./dealCards");

const mockDeal = dealCardsWithEntropy as jest.MockedFunction<typeof dealCardsWithEntropy>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;

describe("useAutoDeal", () => {
    let submit: jest.Mock<void, [SubmitActionRequest]>;

    beforeEach(() => {
        submit = jest.fn();
        mockDeal.mockReset();
        mockDeal.mockResolvedValue({ hash: "0xdeal", gameId: TABLE_ID, action: "deal", amount: "0" } as never);
    });

    describe("gating", () => {
        it("does not fire when disabled", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, undefined, false));
            expect(submit).not.toHaveBeenCalled();
        });

        it("does not fire when DEAL is not legal", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, false, true, submit, undefined, true));
            expect(submit).not.toHaveBeenCalled();
        });

        it("does not fire when it is not the user's turn", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, false, submit, undefined, true));
            expect(submit).not.toHaveBeenCalled();
        });
    });

    describe("firing", () => {
        it("submits the deal through the controller and never broadcasts by itself", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, undefined, true));

            expect(submit).toHaveBeenCalledTimes(1);
            expect(submit.mock.calls[0][0].actionName).toBe("deal");
            // The broadcast belongs to the controller: it runs `run` when the
            // queue reaches this job, not the hook.
            expect(mockDeal).not.toHaveBeenCalled();
        });

        it("hands the controller a run() that deals, and reports the hash on success", async () => {
            const onDealSubmitted = jest.fn();
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, onDealSubmitted, true));
            const request = submit.mock.calls[0][0];

            await expect(request.run()).resolves.toMatchObject({ hash: "0xdeal" });
            expect(mockDeal).toHaveBeenCalledWith(TABLE_ID, NETWORK, "");

            request.onSuccess?.("0xdeal");
            expect(onDealSubmitted).toHaveBeenCalledWith("0xdeal");
        });

        it("fires once per opportunity and re-arms when DEAL goes away", () => {
            const { rerender } = renderHook(({ hasDeal }) => useAutoDeal(TABLE_ID, NETWORK, hasDeal, true, submit, undefined, true), {
                initialProps: { hasDeal: true }
            });
            rerender({ hasDeal: true });
            expect(submit).toHaveBeenCalledTimes(1);

            rerender({ hasDeal: false });
            rerender({ hasDeal: true });
            expect(submit).toHaveBeenCalledTimes(2);
        });
    });

    // ui#662, same shape as the blinds: the latch was set before the trigger ran,
    // and the trigger returns without submitting when the table id is missing.
    describe("late inputs (ui#662)", () => {
        it("submits exactly once when the table id arrives after the opportunity", () => {
            const { rerender } = renderHook(({ id }) => useAutoDeal(id, NETWORK, true, true, submit, undefined, true), {
                initialProps: { id: "" }
            });
            expect(submit).not.toHaveBeenCalled();

            rerender({ id: TABLE_ID });
            expect(submit).toHaveBeenCalledTimes(1);

            rerender({ id: TABLE_ID });
            expect(submit).toHaveBeenCalledTimes(1);
        });
    });

    // ui#655: the c1001 session repeatedly left DEAL on screen after the blinds
    // had posted (hand 1/4, hand 5/2). The auto-deal had fired and been
    // rejected, and the latch outlived the rejection.
    describe("recovery after a rejected auto-deal (ui#655)", () => {
        const fail = (kind: SubmitError["kind"]): SubmitError => ({ kind, message: "rejected", actionName: "deal" });

        it("looks again after a rejection, without a refresh", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, undefined, true));
            expect(submit).toHaveBeenCalledTimes(1);

            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(2);
            expect(submit.mock.calls[1][0].actionName).toBe("deal");
        });

        it("stops after one second look", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("transport")));
            act(() => submit.mock.calls[1][0].onFailure!(fail("transport")));

            expect(submit).toHaveBeenCalledTimes(2);
        });

        it("does not look again when the table has moved past us", () => {
            renderHook(() => useAutoDeal(TABLE_ID, NETWORK, true, true, submit, undefined, true));

            act(() => submit.mock.calls[0][0].onFailure!(fail("stale")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("does not look again once DEAL is no longer legal", () => {
            const { rerender } = renderHook(({ hasDeal }) => useAutoDeal(TABLE_ID, NETWORK, hasDeal, true, submit, undefined, true), {
                initialProps: { hasDeal: true }
            });
            const firstRequest = submit.mock.calls[0][0];

            rerender({ hasDeal: false });
            act(() => firstRequest.onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(1);
        });

        it("gives the next hand its own allowance", () => {
            const { rerender } = renderHook(({ hasDeal }) => useAutoDeal(TABLE_ID, NETWORK, hasDeal, true, submit, undefined, true), {
                initialProps: { hasDeal: true }
            });
            act(() => submit.mock.calls[0][0].onFailure!(fail("terminal")));
            expect(submit).toHaveBeenCalledTimes(2);

            rerender({ hasDeal: false });
            rerender({ hasDeal: true });
            act(() => submit.mock.calls[2][0].onFailure!(fail("terminal")));

            expect(submit).toHaveBeenCalledTimes(4);
        });
    });
});
