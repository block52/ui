import { act, renderHook } from "@testing-library/react";
import { useActionAck } from "../hooks/playerActions/useActionAck";

/**
 * Unit tests for the action-acknowledgement phase machine (Approach A of
 * docs/plans/2026_07_11_action_feedback_ux.md). Timers are faked so the
 * sending floor / confirmed hold / failed hold are exercised deterministically.
 */
describe("useActionAck", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        act(() => jest.runOnlyPendingTimers());
        jest.useRealTimers();
    });

    it("begin() enters the sending phase with the action's label and variant", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("fold"));
        expect(result.current.phase).toBe("sending");
        expect(result.current.label).toBe("Folding…");
        expect(result.current.variant).toBe("fold");
    });

    it("begin() is a no-op for actions without ack copy (deal/new-hand)", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("deal"));
        expect(result.current.phase).toBeNull();
        act(() => result.current.begin("new-hand"));
        expect(result.current.phase).toBeNull();
    });

    it("formats the amount into the label for raise (with 'to') and call (bare)", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("raise", "$6.00"));
        expect(result.current.label).toBe("Raising to $6.00…");
        act(() => result.current.clear());
        act(() => result.current.begin("call", "$2.00"));
        expect(result.current.label).toBe("Calling $2.00…");
    });

    it("confirm() holds the sending floor, then flashes confirmed, then clears", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("call", "$2.00"));
        // Fast path: confirm lands immediately, but the floor keeps it "sending".
        act(() => result.current.confirm());
        expect(result.current.phase).toBe("sending");
        // After the 300ms floor it flips to the confirmed receipt.
        act(() => jest.advanceTimersByTime(300));
        expect(result.current.phase).toBe("confirmed");
        expect(result.current.label).toBe("Called $2.00");
        // After the 600ms hold it fades out.
        act(() => jest.advanceTimersByTime(600));
        expect(result.current.phase).toBeNull();
    });

    it("confirm() flips immediately once the floor has already elapsed (slow path)", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("check"));
        act(() => jest.advanceTimersByTime(400));
        act(() => result.current.confirm());
        expect(result.current.phase).toBe("confirmed");
    });

    it("confirm() is a no-op when nothing is sending", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.confirm());
        expect(result.current.phase).toBeNull();
    });

    it("fail() shows the failure receipt, then clears after the hold", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("fold"));
        act(() => result.current.fail());
        expect(result.current.phase).toBe("failed");
        expect(result.current.label).toBe("Couldn't send — try again");
        act(() => jest.advanceTimersByTime(1400));
        expect(result.current.phase).toBeNull();
    });

    it("fail() is a no-op when no pill is showing", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.fail());
        expect(result.current.phase).toBeNull();
    });

    it("clear() removes the pill immediately (heads-up: it's my turn again)", () => {
        const { result } = renderHook(() => useActionAck());
        act(() => result.current.begin("raise", "$6.00"));
        act(() => result.current.confirm());
        act(() => jest.advanceTimersByTime(300));
        expect(result.current.phase).toBe("confirmed");
        act(() => result.current.clear());
        expect(result.current.phase).toBeNull();
    });
});
