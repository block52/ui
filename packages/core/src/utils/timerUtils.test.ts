import {
    DEFAULT_TIMEOUT_SECONDS,
    getTimeoutMs,
    timeoutToSeconds,
    normalizeTimestamp,
    getLatestActionTimestampMs,
    getTotalTimeoutMs,
    calcTimeRemaining,
    calcProgressPercent,
    makeTurnId,
    resolveTurnAnchor,
    TurnAnchor
} from "./timerUtils";
import { ActionDTO } from "@block52/poker-vm-sdk";

const action = (timestamp: number): ActionDTO => ({ timestamp } as ActionDTO);

describe("getTimeoutMs", () => {
    it("converts seconds to milliseconds", () => {
        expect(getTimeoutMs(60)).toBe(60_000);
    });

    it.each([undefined, null, 0])("falls back to the default when timeout is %s", timeout => {
        expect(getTimeoutMs(timeout)).toBe(DEFAULT_TIMEOUT_SECONDS * 1000);
    });
});

describe("timeoutToSeconds", () => {
    it("floors milliseconds to whole seconds", () => {
        expect(timeoutToSeconds(60_999)).toBe(60);
    });
});

describe("normalizeTimestamp", () => {
    it("scales a 10-digit (seconds) timestamp to ms", () => {
        expect(normalizeTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
    });

    it("leaves a 13-digit (ms) timestamp unchanged", () => {
        expect(normalizeTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
    });
});

describe("getLatestActionTimestampMs", () => {
    it("returns the max timestamp, normalised to ms", () => {
        expect(getLatestActionTimestampMs([action(1_700_000_000), action(1_700_000_050), action(1_700_000_010)])).toBe(1_700_000_050_000);
    });

    it("falls back to Date.now() when there are no actions", () => {
        const before = Date.now();
        const result = getLatestActionTimestampMs([]);
        expect(result).toBeGreaterThanOrEqual(before);
    });
});

describe("getTotalTimeoutMs", () => {
    it("returns the base timeout without an extension", () => {
        expect(getTotalTimeoutMs(30_000, false)).toBe(30_000);
    });

    it("doubles the base timeout with an extension", () => {
        expect(getTotalTimeoutMs(30_000, true)).toBe(60_000);
    });
});

describe("calcTimeRemaining", () => {
    it("returns whole seconds remaining", () => {
        // 30s timeout, 10s elapsed -> 20s remaining
        expect(calcTimeRemaining(10_000, 0, 30_000, false)).toBe(20);
    });

    it("never goes below zero", () => {
        expect(calcTimeRemaining(100_000, 0, 30_000, false)).toBe(0);
    });

    it("accounts for a used extension", () => {
        // 60s effective timeout, 10s elapsed -> 50s remaining
        expect(calcTimeRemaining(10_000, 0, 30_000, true)).toBe(50);
    });
});

describe("calcProgressPercent", () => {
    it("reports elapsed percentage", () => {
        expect(calcProgressPercent(15_000, 0, 30_000, false)).toBe(50);
    });

    it("caps at 100", () => {
        expect(calcProgressPercent(90_000, 0, 30_000, false)).toBe(100);
    });
});

describe("makeTurnId", () => {
    it("combines seat-to-act and action count", () => {
        expect(makeTurnId(3, 5)).toBe("3:5");
    });

    it("uses a sentinel when nextToAct is missing", () => {
        expect(makeTurnId(undefined, 0)).toBe("none:0");
        expect(makeTurnId(null, 2)).toBe("none:2");
    });

    it("changes when the seat-to-act changes", () => {
        expect(makeTurnId(2, 5)).not.toBe(makeTurnId(3, 5));
    });

    it("changes when the action count changes (a new action landed)", () => {
        expect(makeTurnId(3, 5)).not.toBe(makeTurnId(3, 6));
    });
});

describe("resolveTurnAnchor", () => {
    it("re-anchors when the turn id changes", () => {
        const prev: TurnAnchor = { turnId: "2:4", anchorMs: 1_000 };
        expect(resolveTurnAnchor(prev, "3:5", 5_000)).toEqual({ turnId: "3:5", anchorMs: 5_000 });
    });

    it("preserves the previous anchor while the turn id is unchanged", () => {
        const prev: TurnAnchor = { turnId: "3:5", anchorMs: 1_000 };
        // Same turn, but lastActionMs jumped forward (re-stamped/re-broadcast) — ignore it.
        const result = resolveTurnAnchor(prev, "3:5", 9_999);
        expect(result).toBe(prev);
        expect(result.anchorMs).toBe(1_000);
    });

    // Regression for #561 / #560: within one turn the countdown must be monotonic
    // even if the raw action timestamp jumps forward mid-turn.
    it("keeps the countdown non-increasing within a turn when the anchor would jump forward", () => {
        const baseTimeout = 30_000;
        let anchor: TurnAnchor = { turnId: "", anchorMs: 0 };

        // t=0s into the turn, action stamped at 1000
        anchor = resolveTurnAnchor(anchor, "3:5", 1_000);
        const remainingAt5s = calcTimeRemaining(6_000, anchor.anchorMs, baseTimeout, false); // now=6000

        // 6s later the same turn re-broadcasts with the action re-stamped forward to 7000.
        anchor = resolveTurnAnchor(anchor, "3:5", 7_000);
        const remainingAt11s = calcTimeRemaining(12_000, anchor.anchorMs, baseTimeout, false); // now=12000

        // Without the latch, remainingAt11s would be LARGER than remainingAt5s (reversal).
        expect(remainingAt11s).toBeLessThanOrEqual(remainingAt5s);
        expect(remainingAt5s).toBe(25); // 30 - (6000-1000)/1000
        expect(remainingAt11s).toBe(19); // 30 - (12000-1000)/1000, anchor still 1000
    });

    it("does re-anchor once a genuinely new turn begins", () => {
        const baseTimeout = 30_000;
        let anchor: TurnAnchor = { turnId: "3:5", anchorMs: 1_000 };
        // New action lands -> action count moves to 6, seat-to-act moves to 4.
        anchor = resolveTurnAnchor(anchor, "4:6", 12_000);
        expect(anchor.anchorMs).toBe(12_000);
        expect(calcTimeRemaining(13_000, anchor.anchorMs, baseTimeout, false)).toBe(29);
    });
});
