/**
 * Tests for useAutoFold (#605).
 *
 * Two properties matter here beyond the obvious gating:
 *
 *   1. It must still fire when the caller passes fresh callbacks every render.
 *      The effect latches its guard synchronously, arms a 500ms timer and
 *      returns a cleanup that clears it — so a re-render inside that window
 *      cancels the submit, and the latched guard prevents re-arming.
 *   2. `enabled` must be reactive. It is read from a ref, so if it is not a
 *      dependency of the trigger effect, toggling auto-fold ON while the timer
 *      has already expired does nothing.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoFold } from "./useAutoFold";
import { foldHand } from "./foldHand";
import { checkHand } from "./checkHand";

jest.mock("./foldHand");
jest.mock("./checkHand");

const mockFold = foldHand as jest.MockedFunction<typeof foldHand>;
const mockCheck = checkHand as jest.MockedFunction<typeof checkHand>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;

async function settle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useAutoFold", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockFold.mockReset();
        mockCheck.mockReset();
        mockFold.mockResolvedValue({ hash: "0xfold", gameId: TABLE_ID, action: "fold", amount: "0" } as never);
        mockCheck.mockResolvedValue({ hash: "0xcheck", gameId: TABLE_ID, action: "check", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("does not act while time remains", async () => {
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 12, undefined, undefined, undefined, true));
            await settle();
            expect(mockFold).not.toHaveBeenCalled();
        });

        it("does not act when it is not the user's turn", async () => {
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, false, 0, undefined, undefined, undefined, true));
            await settle();
            expect(mockFold).not.toHaveBeenCalled();
        });

        it("does not act when disabled", async () => {
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, undefined, undefined, undefined, false));
            await settle();
            expect(mockFold).not.toHaveBeenCalled();
        });

        it("does not act with neither FOLD nor CHECK legal", async () => {
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, false, false, true, 0, undefined, undefined, undefined, true));
            await settle();
            expect(mockFold).not.toHaveBeenCalled();
        });
    });

    describe("choice of action", () => {
        it("prefers a free CHECK over folding", async () => {
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, true, true, 0, undefined, undefined, undefined, true));
            await settle();

            expect(mockCheck).toHaveBeenCalledTimes(1);
            expect(mockFold).not.toHaveBeenCalled();
        });

        it("folds when checking is not available", async () => {
            const onComplete = jest.fn();
            renderHook(() => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, undefined, onComplete, undefined, true));
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
            expect(onComplete).toHaveBeenCalledWith("fold", "0xfold");
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still folds when the caller passes fresh callbacks every render", async () => {
            const { rerender } = renderHook(() =>
                useAutoFold(
                    TABLE_ID,
                    NETWORK,
                    true,
                    false,
                    true,
                    0,
                    () => {},
                    () => {},
                    () => {},
                    true
                )
            );

            // usePlayerTimer re-renders once a second while it is the player's
            // turn — exactly the window in which auto-fold is armed.
            act(() => {
                jest.advanceTimersByTime(200);
            });
            rerender();
            act(() => {
                jest.advanceTimersByTime(100);
            });
            rerender();

            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
        });

        it("folds exactly once across many renders in the window", async () => {
            const { rerender } = renderHook(() =>
                useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, () => {}, () => {}, () => {}, true)
            );

            for (let i = 0; i < 10; i++) {
                act(() => {
                    jest.advanceTimersByTime(20);
                });
                rerender();
            }
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
        });
    });

    describe("reactive enabled", () => {
        it("acts when auto-fold is switched on after the clock already expired", async () => {
            // The flag is read from a ref, so it has to be a dependency of the
            // trigger effect — otherwise nothing re-evaluates when it flips and
            // the setting appears to do nothing until some other value changes.
            const { rerender } = renderHook(
                ({ enabled }) => useAutoFold(TABLE_ID, NETWORK, true, false, true, 0, undefined, undefined, undefined, enabled),
                { initialProps: { enabled: false } }
            );
            await settle();
            expect(mockFold).not.toHaveBeenCalled();

            rerender({ enabled: true });
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(1);
        });

        it("stops acting when switched off before the clock expires", async () => {
            const { rerender } = renderHook(
                ({ enabled, time }) =>
                    useAutoFold(TABLE_ID, NETWORK, true, false, true, time, undefined, undefined, undefined, enabled),
                { initialProps: { enabled: true, time: 5 } }
            );

            rerender({ enabled: false, time: 0 });
            await settle();

            expect(mockFold).not.toHaveBeenCalled();
        });
    });

    describe("re-arming", () => {
        it("acts again on the next opportunity", async () => {
            const { rerender } = renderHook(
                ({ time }) => useAutoFold(TABLE_ID, NETWORK, true, false, true, time, undefined, undefined, undefined, true),
                { initialProps: { time: 0 } }
            );
            await settle();
            expect(mockFold).toHaveBeenCalledTimes(1);

            rerender({ time: 30 });
            rerender({ time: 0 });
            await settle();

            expect(mockFold).toHaveBeenCalledTimes(2);
        });
    });
});
