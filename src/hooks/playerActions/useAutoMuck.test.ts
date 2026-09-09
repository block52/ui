/**
 * Tests for useAutoMuck (#605).
 *
 * Same timer-cancellation defect as useAutoFold/useAutoShowCards, with one
 * difference worth pinning: this hook's guard resets on the TURN ending rather
 * than on the action flag clearing, and it defaults to disabled.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoMuck } from "./useAutoMuck";
import { muckCards } from "./muckCards";

jest.mock("./muckCards");

const mockMuck = muckCards as jest.MockedFunction<typeof muckCards>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;

async function settle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useAutoMuck", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockMuck.mockReset();
        mockMuck.mockResolvedValue({ hash: "0xmuck", gameId: TABLE_ID, action: "muck", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("is off unless explicitly enabled", async () => {
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true));
            await settle();
            expect(mockMuck).not.toHaveBeenCalled();
        });

        it("does not fire when MUCK is not legal", async () => {
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, false, true, undefined, undefined, undefined, true));
            await settle();
            expect(mockMuck).not.toHaveBeenCalled();
        });

        it("does not fire when it is not the user's turn", async () => {
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, false, undefined, undefined, undefined, true));
            await settle();
            expect(mockMuck).not.toHaveBeenCalled();
        });
    });

    describe("firing", () => {
        it("mucks once when enabled and it is the user's turn", async () => {
            const onStarted = jest.fn();
            const onComplete = jest.fn();
            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true, onStarted, onComplete, undefined, true));

            await settle();

            expect(mockMuck).toHaveBeenCalledTimes(1);
            expect(onStarted).toHaveBeenCalledTimes(1);
            expect(onComplete).toHaveBeenCalledWith("0xmuck");
        });

        it("reports an error without wedging the hook", async () => {
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            const onError = jest.fn();
            mockMuck.mockRejectedValueOnce(new Error("nope"));

            renderHook(() => useAutoMuck(TABLE_ID, NETWORK, true, true, undefined, undefined, onError, true));
            await settle();

            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            spy.mockRestore();
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still mucks when the caller passes fresh callbacks every render", async () => {
            const { rerender } = renderHook(() =>
                useAutoMuck(
                    TABLE_ID,
                    NETWORK,
                    true,
                    true,
                    () => {},
                    () => {},
                    () => {},
                    true
                )
            );

            act(() => {
                jest.advanceTimersByTime(200);
            });
            rerender();
            act(() => {
                jest.advanceTimersByTime(100);
            });
            rerender();

            await settle();

            expect(mockMuck).toHaveBeenCalledTimes(1);
        });
    });

    describe("reactive enabled", () => {
        it("mucks when switched on while the opportunity is already open", async () => {
            const { rerender } = renderHook(
                ({ enabled }) => useAutoMuck(TABLE_ID, NETWORK, true, true, undefined, undefined, undefined, enabled),
                { initialProps: { enabled: false } }
            );
            await settle();
            expect(mockMuck).not.toHaveBeenCalled();

            rerender({ enabled: true });
            await settle();

            expect(mockMuck).toHaveBeenCalledTimes(1);
        });
    });

    describe("re-arming", () => {
        it("mucks again on the next hand's showdown", async () => {
            const { rerender } = renderHook(
                ({ turn }) => useAutoMuck(TABLE_ID, NETWORK, true, turn, undefined, undefined, undefined, true),
                { initialProps: { turn: true } }
            );
            await settle();
            expect(mockMuck).toHaveBeenCalledTimes(1);

            rerender({ turn: false });
            rerender({ turn: true });
            await settle();

            expect(mockMuck).toHaveBeenCalledTimes(2);
        });
    });
});
