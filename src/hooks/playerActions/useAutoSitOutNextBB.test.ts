import { renderHook } from "@testing-library/react";
import { useAutoSitOutNextBB } from "./useAutoSitOutNextBB";

/**
 * The hook now only DETECTS the BB landing and calls `onTrigger`; the parent
 * owns the actual submission (routed through the ActionSubmitController). These
 * tests assert the detection / single-shot / re-arm behavior via the callback.
 */
describe("useAutoSitOutNextBB", () => {
    it("does not fire when disabled even if BB matches seat", () => {
        const onTrigger = jest.fn();
        renderHook(() => useAutoSitOutNextBB(3, 3, false, onTrigger));
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("does not fire when BB is not on the user's seat", () => {
        const onTrigger = jest.fn();
        renderHook(() => useAutoSitOutNextBB(3, 5, true, onTrigger));
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("fires once when enabled and BB lands on the user's seat", () => {
        const onTrigger = jest.fn();
        renderHook(() => useAutoSitOutNextBB(3, 3, true, onTrigger));
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("does not re-fire while BB stays on the seat across re-renders", () => {
        const onTrigger = jest.fn();
        const { rerender } = renderHook(
            ({ bb }: { bb: number }) => useAutoSitOutNextBB(3, bb, true, onTrigger),
            { initialProps: { bb: 3 } }
        );
        expect(onTrigger).toHaveBeenCalledTimes(1);

        rerender({ bb: 3 });
        rerender({ bb: 3 });
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("re-arms and fires again when BB moves off then back onto the seat", () => {
        const onTrigger = jest.fn();
        const { rerender } = renderHook(
            ({ bb }: { bb: number }) => useAutoSitOutNextBB(3, bb, true, onTrigger),
            { initialProps: { bb: 3 } }
        );
        expect(onTrigger).toHaveBeenCalledTimes(1);

        // BB moves away (new hand) → arm reset
        rerender({ bb: 4 });
        // BB orbits all the way back
        rerender({ bb: 3 });

        expect(onTrigger).toHaveBeenCalledTimes(2);
    });

    it("does nothing when userSeat is undefined", () => {
        const onTrigger = jest.fn();
        renderHook(() => useAutoSitOutNextBB(undefined, 3, true, onTrigger));
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("does nothing when bigBlindPosition is undefined", () => {
        const onTrigger = jest.fn();
        renderHook(() => useAutoSitOutNextBB(3, undefined, true, onTrigger));
        expect(onTrigger).not.toHaveBeenCalled();
    });
});
