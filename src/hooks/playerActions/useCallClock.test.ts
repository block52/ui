/**
 * Tests for useCallClock (ui#819): the observer's side of the turn clock.
 *
 *   1. It submits the `timeout` action once the due time passes, not before,
 *      and exactly once per due time however often the caller re-renders.
 *   2. It submits through the ActionSubmitController and STANDS DOWN while that
 *      queue is busy, re-arming when it clears (#635).
 *   3. A new due time (the next stalled turn) is a new opportunity.
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

jest.mock("./callClock");

const mockCallClock = callClock as jest.MockedFunction<typeof callClock>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;
const START = 1_700_000_000_000;

interface Props {
    dueAtMs?: number | null;
    isBusy?: boolean;
    enabled?: boolean;
}

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
            ({ dueAtMs = START + 10_000, isBusy = false, enabled = true }: Props) =>
                useCallClock(TABLE_ID, NETWORK, dueAtMs, harness.submit, isBusy, onCalled, enabled),
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
            render({ dueAtMs: START - 60_000 });
            await advance(AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);
        });

        it("never calls with no due time", async () => {
            render({ dueAtMs: null });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
        });

        it("drops a pending call when the due time goes away (the turn moved on)", async () => {
            const { rerender } = render();
            await advance(9_000);
            rerender({ dueAtMs: null });
            await advance(60_000);
            expect(harness.requests).toHaveLength(0);
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

        it("a new due time is a new opportunity", async () => {
            const { rerender } = render();
            await advance(10_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(1);

            // The next turn stalls too.
            rerender({ dueAtMs: START + 40_000 });
            await advance(30_000 + AUTO_ACTION_DELAY_MS);
            expect(harness.requests).toHaveLength(2);
        });
    });

    describe("through the submit controller (#635)", () => {
        it("submits rather than broadcasting: nothing runs until the controller runs it", async () => {
            const requests: SubmitActionRequest[] = [];
            renderHook(() => useCallClock(TABLE_ID, NETWORK, START - 1, request => requests.push(request), false, undefined, true));
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests.map(r => r.actionName)).toEqual([NonPlayerActionType.TIMEOUT]);
            expect(mockCallClock).not.toHaveBeenCalled();
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
            renderHook(() => useCallClock(TABLE_ID, NETWORK, START - 1, submit, false, undefined, true));
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests).toHaveLength(1);
            await advance(AUTO_ACTION_DELAY_MS);
            expect(requests).toHaveLength(2);
            await advance(60_000);
            expect(requests).toHaveLength(2);
        });

        it("does not re-arm after the chain rejected the call", async () => {
            const { submit, requests } = failWith("rejected");
            renderHook(() => useCallClock(TABLE_ID, NETWORK, START - 1, submit, false, undefined, true));
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
