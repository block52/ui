import { renderHook, act } from "@testing-library/react";
import { useLatchedDelay, AUTO_ACTION_DELAY_MS } from "./useLatchedDelay";

const settle = () => act(() => jest.advanceTimersByTime(AUTO_ACTION_DELAY_MS));

describe("useLatchedDelay", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("fires once after the settle delay, not before", () => {
        const fire = jest.fn(() => true);
        renderHook(() => useLatchedDelay(true, false, fire));

        act(() => jest.advanceTimersByTime(AUTO_ACTION_DELAY_MS - 1));
        expect(fire).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(1));
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("does not fire while not armed", () => {
        const fire = jest.fn(() => true);
        renderHook(() => useLatchedDelay(false, false, fire));
        settle();
        expect(fire).not.toHaveBeenCalled();
    });

    it("is immune to a fresh fire closure on every render (ui#605)", () => {
        const calls: number[] = [];
        let render = 0;
        const { rerender } = renderHook(() => {
            const id = ++render;
            useLatchedDelay(true, false, () => {
                calls.push(id);
                return true;
            });
        });
        for (let i = 0; i < 5; i++) {
            act(() => jest.advanceTimersByTime(90));
            rerender();
        }
        settle();

        expect(calls).toHaveLength(1);
        // …and it ran the LATEST closure, not the one captured when it armed.
        expect(calls[0]).toBe(render);
    });

    it("stays latched after firing until the opportunity passes, then fires again", () => {
        const fire = jest.fn(() => true);
        const { rerender } = renderHook(({ arm, reset }) => useLatchedDelay(arm, reset, fire), { initialProps: { arm: true, reset: false } });
        settle();
        rerender({ arm: true, reset: false });
        settle();
        expect(fire).toHaveBeenCalledTimes(1);

        rerender({ arm: false, reset: true });
        rerender({ arm: true, reset: false });
        settle();
        expect(fire).toHaveBeenCalledTimes(2);
    });

    it("re-arms when it is disarmed and re-armed INSIDE the settle window", () => {
        // The submit queue went busy and then idle before the timer elapsed. A
        // cancelled timer must not leave the latch shut.
        const fire = jest.fn(() => true);
        const { rerender } = renderHook(({ arm }) => useLatchedDelay(arm, false, fire), { initialProps: { arm: true } });
        act(() => jest.advanceTimersByTime(200));
        rerender({ arm: false });
        settle();
        expect(fire).not.toHaveBeenCalled();

        rerender({ arm: true });
        settle();
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("reopens the latch when fire reports it did not act", () => {
        const fire = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
        const { rerender } = renderHook(({ arm }) => useLatchedDelay(arm, false, fire), { initialProps: { arm: true } });
        settle();
        expect(fire).toHaveBeenCalledTimes(1);

        rerender({ arm: false });
        rerender({ arm: true });
        settle();
        expect(fire).toHaveBeenCalledTimes(2);
    });

    it("cancels a pending fire on unmount", () => {
        const fire = jest.fn(() => true);
        const { unmount } = renderHook(() => useLatchedDelay(true, false, fire));
        unmount();
        settle();
        expect(fire).not.toHaveBeenCalled();
    });
});
