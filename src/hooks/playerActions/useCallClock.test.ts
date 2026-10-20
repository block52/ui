/**
 * Tests for useCallClock (ui#819): the observer's side of the turn clock.
 *
 *   1. It submits the `timeout` action once the due time passes, not before,
 *      and exactly once per TURN however often the caller re-renders — a
 *      re-stamped due time for the same turn only moves the timer.
 *   2. It submits through the ActionSubmitController, quietly, and STANDS DOWN
 *      while that queue is busy or the socket is not live, re-arming when
 *      either clears (#635, #613).
 *   3. A new turn is a new opportunity.
 *   4. A failure that proves nothing was sent re-arms once; a chain rejection
 *      does not (#655).
 *   5. `enabled` is reactive.
 */
import { renderHook, act } from "@testing-library/react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { useCallClock } from "./useCallClock";
import { callClock } from "./callClock";
import { makeTestSubmit } from "./testSubmit";
import { AUTO_ACTION_DELAY_MS } from "./useLatchedDelay";
import type { SubmitActionRequest } from "../../submit/types";
import type { ClockCallOpportunity } from "../../utils/turnClock";

jest.mock("./callClock");

const mockCallClock = callClock as jest.MockedFunction<typeof callClock>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;
const START = 1_700_000_000_000;

interface Props {
    opportunity?: ClockCallOpportunity | null;
    isBusy?: boolean;
    isLive?: boolean;
    enabled?: boolean;
}

const at = (dueAtMs: number, key = "1:2:4"): ClockCallOpportunity => ({ key, seat: 2, dueAtMs });
const DEFAULT = at(START + 10_000);

async function advance(ms: number): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(ms);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useCallClock", () => {
    let harness: ReturnType<typeof makeTestSubmit>;
    const onCalled = jest.fn();

    const render = (initial: Props = {}) =>
        renderHook(
            ({ opportunity = DEFAULT, isBusy = false, isLive = true, enabled = true }: Props) =>
                useCallClock(TABLE_ID, NETWORK, opportunity, harness.submit, isBusy, isLive, onCalled, enabled),
            { initialProps: initial }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(START);
        harness = makeTestSubmit();
        onCalled.mockReset();
        mockCallClock.mockReset();
        mockCallClock.mockResolvedValue({ hash: "0xclock", gameId: TABLE_ID, action: "timeout", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("timing", () => {
        it("does not call before the due time", async () => {
            render();
            await advance(9_000);
            expect(harness.requests).toHaveLength(0);
        });

        it("calls once the due time (plus the settle) has passed", async () => {
            render();
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests.map(r => r.actionName)).toEqual([NonPlayerActionType.TIMEOUT]);
            expect(mockCallClock).toHaveBeenCalledWith(TABLE_ID, NETWORK);
            expect(onCalled).toHaveBeenCalledWith("0xclock");
        });

        it("calls at once (after the settle) when the due time is already in the past", async () => {
            render({ opportunity: at(START - 60_000) });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });

        it("never calls with no opportunity", async () => {
            render({ opportunity: null });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
        });

        it("drops a pending call when the opportunity goes away (the turn moved on)", async () => {
            const { rerender } = render();
            await advance(9_000);
            rerender({ opportunity: null });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
        });

        it("a re-stamped due time for the same turn moves the timer, not the latch", async () => {
            const { rerender } = render();
            await advance(9_000);
            // The anchoring action's timestamp moved 1 s later (same turn).
            rerender({ opportunity: at(START + 11_000) });
            await advance(1_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(0);
            await advance(1_000);
            expect(harness.requests).toHaveLength(1);
        });
    });

    describe("once per opportunity", () => {
        it("calls exactly once however often the caller re-renders", async () => {
            const { rerender } = render();
            for (let i = 0; i < 10; i++) {
                await advance(1_500);
                rerender({});
            }
            expect(harness.requests).toHaveLength(1);
        });

        it("does not call twice on one opportunity, even after a rejected broadcast", async () => {
            mockCallClock.mockRejectedValue(new Error("rejected"));
            const { rerender } = render();
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            rerender({});
            await advance(5_000);
            expect(harness.requests).toHaveLength(1);
        });

        it("a re-stamped due time for an already-called turn is NOT a second opportunity", async () => {
            const { rerender } = render();
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);

            rerender({ opportunity: at(START + 11_000) });
            await advance(60_000);
            expect(harness.requests).toHaveLength(1);
        });

        it("a new turn is a new opportunity", async () => {
            const { rerender } = render();
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);

            // The next turn stalls too.
            rerender({ opportunity: at(START + 40_000, "1:3:5") });
            await advance(30_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(2);
        });
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting: nothing runs until the controller runs it", async () => {
            const requests: SubmitActionRequest[] = [];
            renderHook(() => useCallClock(TABLE_ID, NETWORK, at(START - 1), request => requests.push(request), false, true, undefined, true));
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests.map(r => r.actionName)).toEqual([NonPlayerActionType.TIMEOUT]);
            expect(mockCallClock).not.toHaveBeenCalled();
        });

        it("submits a QUIET job: the user did nothing, so a failure is not theirs to hear about", async () => {
            render({ opportunity: at(START - 1) });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests[0].quiet).toBe(true);
        });

        it("stands down while the player's own action is in flight, then calls when the queue clears", async () => {
            const { rerender } = render({ isBusy: true });
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(0);

            rerender({ isBusy: false });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });

        it("never queues behind an action that starts INSIDE the settle window", async () => {
            const { rerender } = render();
            await advance(10_000 + 200);
            rerender({ isBusy: true });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(0);
        });
    });

    describe("while the socket is not live (#613)", () => {
        it("stands down, then calls once the connection is back", async () => {
            const { rerender } = render({ isLive: false });
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(0);

            rerender({ isLive: true });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });

        it("a drop INSIDE the settle window holds the call until the socket is live again", async () => {
            const { rerender } = render();
            await advance(10_000 + 200);
            rerender({ isLive: false });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);

            rerender({ isLive: true });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });
    });

    describe("re-arming after a failure (#655)", () => {
        const failWith = (kind: "transport" | "rejected") => {
            let failed = false;
            const requests: SubmitActionRequest[] = [];
            const submit = (request: SubmitActionRequest): void => {
                requests.push(request);
                if (!failed) {
                    failed = true;
                    request.onFailure?.({ kind, message: kind, actionName: request.actionName });
                }
            };
            return { submit, requests };
        };

        it("re-arms once after a transport failure (nothing was sent)", async () => {
            const { submit, requests } = failWith("transport");
            renderHook(() => useCallClock(TABLE_ID, NETWORK, at(START - 1), submit, false, true, undefined, true));
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests).toHaveLength(1);
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests).toHaveLength(2);
            await advance(60_000);
            expect(requests).toHaveLength(2);
        });

        it("does not re-arm after the chain rejected the call", async () => {
            const { submit, requests } = failWith("rejected");
            renderHook(() => useCallClock(TABLE_ID, NETWORK, at(START - 1), submit, false, true, undefined, true));
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests).toHaveLength(1);
            await advance(60_000);
            expect(requests).toHaveLength(1);
        });
    });

    describe("reactive enabled", () => {
        it("does not call when disabled", async () => {
            render({ enabled: false });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
        });

        it("calls when switched on after the due time already passed", async () => {
            const { rerender } = render({ enabled: false });
            await advance(20_000);
            expect(harness.requests).toHaveLength(0);

            rerender({ enabled: true });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });

        it("stops a pending call when switched off", async () => {
            const { rerender } = render({ enabled: true });
            await advance(9_000);
            rerender({ enabled: false });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
        });
    });
});
