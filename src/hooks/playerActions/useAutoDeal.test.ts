/**
 * Tests for useAutoDeal (ui#635).
 *
 * The hook no longer broadcasts: it hands the deal to the ActionSubmitController
 * so every tx from this account goes through one queue.
 */
import { renderHook } from "@testing-library/react";
import { useAutoDeal } from "./useAutoDeal";
import { dealCardsWithEntropy } from "./dealCards";
import type { SubmitActionRequest } from "../../submit/types";

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
});
