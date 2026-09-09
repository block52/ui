/**
 * Tests for useAutoShowCards (#605).
 *
 * This hook has NO `enabled` parameter — it runs for every player on every
 * table — so the timer-cancellation defect it shares with useAutoFold,
 * useAutoMuck and usePreCheck applies unconditionally here.
 *
 * The shape of that defect: the effect latches `hasTriggeredRef` synchronously,
 * arms a 500ms timer, and returns a cleanup that clears it. Because the effect
 * depends on `triggerAutoShow`, whose identity changes whenever the caller
 * passes fresh callbacks, ANY re-render inside that 500ms window cancels the
 * pending submit — and the latched guard stops it being re-armed.
 */
import { renderHook, act } from "@testing-library/react";
import { useAutoShowCards } from "./useAutoShowCards";
import { showCards } from "./showCards";

jest.mock("./showCards");

const mockShowCards = showCards as jest.MockedFunction<typeof showCards>;

const TABLE_ID = "0xtable";
const NETWORK = {} as never;

async function settle(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useAutoShowCards", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockShowCards.mockReset();
        mockShowCards.mockResolvedValue({ hash: "0xhash", gameId: TABLE_ID, action: "show", amount: "0" } as never);
    });
    afterEach(() => jest.useRealTimers());

    describe("gating", () => {
        it("does not fire when SHOW is not legal", async () => {
            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, false, true, 0));
            await settle();
            expect(mockShowCards).not.toHaveBeenCalled();
        });

        it("does not fire when it is not the user's turn", async () => {
            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, false, 0));
            await settle();
            expect(mockShowCards).not.toHaveBeenCalled();
        });

        it("does not fire while time remains on the clock", async () => {
            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 5));
            await settle();
            expect(mockShowCards).not.toHaveBeenCalled();
        });
    });

    describe("firing", () => {
        it("submits SHOW once when the clock expires", async () => {
            const onStarted = jest.fn();
            const onComplete = jest.fn();
            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, onStarted, onComplete));

            await settle();

            expect(mockShowCards).toHaveBeenCalledTimes(1);
            expect(onStarted).toHaveBeenCalledTimes(1);
            expect(onComplete).toHaveBeenCalledWith("0xhash");
        });

        it("reports an error without leaving the hook wedged", async () => {
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            const onError = jest.fn();
            mockShowCards.mockRejectedValueOnce(new Error("rejected by chain"));

            renderHook(() => useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, undefined, undefined, onError));
            await settle();

            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            spy.mockRestore();
        });
    });

    describe("re-renders during the settle window (#605)", () => {
        it("still submits when the caller passes fresh callbacks every render", async () => {
            // The real caller (PokerActionPanel) passes inline arrows, so every
            // render gives the hook new callback identities. A re-render inside
            // the 500ms window is near-certain: usePlayerTimer ticks once a
            // second precisely while it is the player's turn.
            const { rerender } = renderHook(() =>
                useAutoShowCards(
                    TABLE_ID,
                    NETWORK,
                    true,
                    true,
                    0,
                    () => {},
                    () => {},
                    () => {}
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

            expect(mockShowCards).toHaveBeenCalledTimes(1);
        });

        it("does not submit twice when many renders land in the window", async () => {
            const { rerender } = renderHook(() =>
                useAutoShowCards(TABLE_ID, NETWORK, true, true, 0, () => {}, () => {}, () => {})
            );

            for (let i = 0; i < 10; i++) {
                act(() => {
                    jest.advanceTimersByTime(20);
                });
                rerender();
            }
            await settle();

            expect(mockShowCards).toHaveBeenCalledTimes(1);
        });
    });

    describe("re-arming", () => {
        it("fires again on the next opportunity", async () => {
            const { rerender } = renderHook(
                ({ turn, time }) => useAutoShowCards(TABLE_ID, NETWORK, true, turn, time),
                { initialProps: { turn: true, time: 0 } }
            );
            await settle();
            expect(mockShowCards).toHaveBeenCalledTimes(1);

            // Turn passes, then comes back around with a fresh clock.
            rerender({ turn: false, time: 30 });
            rerender({ turn: true, time: 0 });
            await settle();

            expect(mockShowCards).toHaveBeenCalledTimes(2);
        });
    });
});
