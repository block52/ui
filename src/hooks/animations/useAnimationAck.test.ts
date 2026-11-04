import { renderHook, act } from "@testing-library/react";
import { useAnimationAck } from "./useAnimationAck";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import type { AnimationHint } from "../../bus/types";

jest.mock("../../context/gameState/GameEventsContext");

const mockUseGameEventsContext = useGameEventsContext as jest.MockedFunction<typeof useGameEventsContext>;

let ackAnimation: jest.Mock;

function hint(ackId?: string): AnimationHint {
    return { kind: "dealCards", ackId, ackTimeoutMs: ackId ? 1800 : undefined };
}

beforeEach(() => {
    ackAnimation = jest.fn();
    mockUseGameEventsContext.mockReturnValue({ latestItem: null, ackAnimation, isPlayingSuspense: () => false });
});

describe("useAnimationAck", () => {
    it("forwards done(ackId) to the bus's ackAnimation", () => {
        const { result } = renderHook(() => useAnimationAck([hint("1:0")]));
        act(() => result.current("1:0"));
        expect(ackAnimation).toHaveBeenCalledTimes(1);
        expect(ackAnimation).toHaveBeenCalledWith("1:0");
    });

    it("is idempotent per ackId within the same commit", () => {
        const { result } = renderHook(() => useAnimationAck([hint("1:0")]));
        act(() => {
            result.current("1:0");
            result.current("1:0");
            result.current("1:0");
        });
        expect(ackAnimation).toHaveBeenCalledTimes(1);
    });

    it("acks again after the committed hints change (new commit)", () => {
        const { result, rerender } = renderHook(({ hints }) => useAnimationAck(hints), {
            initialProps: { hints: [hint("1:0")] }
        });
        act(() => result.current("1:0"));
        expect(ackAnimation).toHaveBeenCalledTimes(1);

        // New commit → new ack ids → the idempotency set resets.
        rerender({ hints: [hint("2:0")] });
        act(() => result.current("2:0"));
        expect(ackAnimation).toHaveBeenCalledTimes(2);
        expect(ackAnimation).toHaveBeenLastCalledWith("2:0");
    });

    it("returns a stable callback across re-renders with the same hints", () => {
        const { result, rerender } = renderHook(({ hints }) => useAnimationAck(hints), {
            initialProps: { hints: [hint("1:0")] }
        });
        const first = result.current;
        rerender({ hints: [hint("1:0")] });
        expect(result.current).toBe(first);
    });
});
