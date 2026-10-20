import { act, renderHook } from "@testing-library/react";
import { useReplayTransport } from "./useReplayTransport";
import { REPLAY_STEP_MS } from "../../utils/replayTimeline";

describe("useReplayTransport (ui#816)", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("rests at the final state of a new timeline, paused", () => {
        const { result, rerender } = renderHook(({ n }) => useReplayTransport(n), { initialProps: { n: 0 } });
        expect(result.current.position).toBe(0);
        rerender({ n: 6 });
        expect(result.current.position).toBe(5);
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.atEnd).toBe(true);
    });

    it("steps back and forward within the timeline", () => {
        const { result } = renderHook(() => useReplayTransport(4));
        act(() => result.current.stepBack());
        act(() => result.current.stepBack());
        expect(result.current.position).toBe(1);
        act(() => result.current.stepForward());
        expect(result.current.position).toBe(2);
        act(() => result.current.seek(99));
        expect(result.current.position).toBe(3);
        act(() => result.current.seek(-5));
        expect(result.current.position).toBe(0);
        expect(result.current.atStart).toBe(true);
    });

    it("plays from the deal when started at the end, one step per delay, and pauses at the end", () => {
        const { result } = renderHook(() => useReplayTransport(3));
        act(() => result.current.play());
        expect(result.current.position).toBe(0);
        expect(result.current.isPlaying).toBe(true);
        act(() => jest.advanceTimersByTime(REPLAY_STEP_MS));
        expect(result.current.position).toBe(1);
        act(() => jest.advanceTimersByTime(REPLAY_STEP_MS));
        expect(result.current.position).toBe(2);
        expect(result.current.isPlaying).toBe(false);
    });

    it("resumes from where it was paused, and speed changes the pace", () => {
        const { result } = renderHook(() => useReplayTransport(5));
        act(() => result.current.seek(1));
        act(() => result.current.setSpeed(2));
        act(() => result.current.play());
        expect(result.current.position).toBe(1);
        act(() => jest.advanceTimersByTime(REPLAY_STEP_MS / 2));
        expect(result.current.position).toBe(2);
        act(() => result.current.pause());
        act(() => jest.advanceTimersByTime(REPLAY_STEP_MS * 4));
        expect(result.current.position).toBe(2);
        act(() => result.current.togglePlay());
        expect(result.current.isPlaying).toBe(true);
        act(() => result.current.togglePlay());
        expect(result.current.isPlaying).toBe(false);
    });

    it("a manual step pauses playback; an unknown speed plays at 1×", () => {
        const { result } = renderHook(() => useReplayTransport(5));
        act(() => result.current.play());
        act(() => result.current.stepForward());
        expect(result.current.isPlaying).toBe(false);
        act(() => result.current.setSpeed(7));
        expect(result.current.speed).toBe(1);
    });

    it("does not play a single-step timeline", () => {
        const { result } = renderHook(() => useReplayTransport(1));
        act(() => result.current.play());
        expect(result.current.isPlaying).toBe(false);
    });
});
