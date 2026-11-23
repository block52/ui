import { autoDealDecision } from "./autoDealDeferral";
import { AUTO_DEAL_DEFER_POLL_MS, MAX_AUTO_DEAL_DEFER_MS } from "../bus/timing";

describe("autoDealDecision (ui#873)", () => {
    it("deals at once when no run-out is showing — normal hands keep their speed", () => {
        expect(autoDealDecision({ suspenseActive: false, waitedMs: 0 })).toEqual({ kind: "deal" });
    });

    it("waits while a tournament run-out is still on screen, re-checking on the poll", () => {
        expect(autoDealDecision({ suspenseActive: true, waitedMs: 0 })).toEqual({ kind: "wait", recheckInMs: AUTO_DEAL_DEFER_POLL_MS });
    });

    it("never waits past the cap, so a stuck render cannot stop the table", () => {
        expect(autoDealDecision({ suspenseActive: true, waitedMs: MAX_AUTO_DEAL_DEFER_MS })).toEqual({ kind: "deal" });
        expect(autoDealDecision({ suspenseActive: true, waitedMs: MAX_AUTO_DEAL_DEFER_MS + 60_000 })).toEqual({ kind: "deal" });
    });

    it("re-checks no later than the cap", () => {
        expect(autoDealDecision({ suspenseActive: true, waitedMs: 900, maxDeferMs: 1000 })).toEqual({ kind: "wait", recheckInMs: 100 });
    });
});
