/**
 * The re-arm policy (ui#655, ui#661).
 *
 * The whole point is that it is NOT "retry until it works": the table below is
 * the contract, and a kind moving across it changes whether a stalled table
 * recovers by itself or quietly re-sends something the chain already refused.
 */
import { MAX_AUTO_REARMS, shouldRearmAfterFailure } from "./autoActionRearm";
import type { SubmitError } from "../../submit/types";

const error = (kind: SubmitError["kind"]): SubmitError => ({ kind, message: "x", actionName: "small-blind" });

describe("shouldRearmAfterFailure", () => {
    it("re-arms when the action demonstrably did not take effect", () => {
        // The c1001 case: "account sequence mismatch" is classified `terminal`
        // and nothing was broadcast — this is the stall the tickets describe.
        expect(shouldRearmAfterFailure(error("terminal"))).toBe(true);
        expect(shouldRearmAfterFailure(error("transport"))).toBe(true);
        expect(shouldRearmAfterFailure(error("offline"))).toBe(true);
    });

    it("does not re-arm when the table has moved past us", () => {
        expect(shouldRearmAfterFailure(error("stale"))).toBe(false);
        expect(shouldRearmAfterFailure(error("superseded"))).toBe(false);
    });

    it("does not re-arm a chain rejection — a rejection is reported, not retried", () => {
        expect(shouldRearmAfterFailure(error("rejected"))).toBe(false);
    });

    it("allows exactly one second look", () => {
        expect(MAX_AUTO_REARMS).toBe(1);
    });
});
