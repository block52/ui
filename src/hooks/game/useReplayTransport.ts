import { useCallback, useEffect, useState } from "react";
import { REPLAY_SPEEDS, clampStep, stepDelayMs } from "../../utils/replayTimeline";

export interface ReplayTransport {
    /** The current step, 0-based; the last step is the hand's final state. */
    position: number;
    isPlaying: boolean;
    speed: number;
    atStart: boolean;
    atEnd: boolean;
    play: () => void;
    pause: () => void;
    togglePlay: () => void;
    stepBack: () => void;
    stepForward: () => void;
    seek: (position: number) => void;
    setSpeed: (speed: number) => void;
}

/**
 * Media-player transport over a replay timeline (ui#816): play / pause,
 * step, scrub, speed. It owns the POSITION only; whoever renders it loads the
 * step the position names (see useReplayTimeline).
 *
 * A new timeline (a different step count) rests at its LAST step — the hand's
 * final state, which is what `?hand=N` has always shown — and paused. Play
 * from the end starts over from the deal. Playback advances one step per
 * `stepDelayMs(speed)` and pauses itself at the end.
 *
 * @param stepCount - Number of steps in the timeline (0 while loading)
 */
export function useReplayTransport(stepCount: number): ReplayTransport {
    const [position, setPosition] = useState<number>(() => clampStep(stepCount - 1, stepCount));
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [speed, setSpeedState] = useState<number>(1);

    // A new timeline: rest at its final state, paused. Adjusted during render
    // (not in an effect) so the render that first sees the new timeline already
    // carries the resting position — an effect would let one render through
    // with the stale position, and a step loader keyed on it would fetch the
    // deal while the arrival state (the hand's end) is on screen.
    const [seenStepCount, setSeenStepCount] = useState<number>(stepCount);
    if (seenStepCount !== stepCount) {
        setSeenStepCount(stepCount);
        setPosition(clampStep(stepCount - 1, stepCount));
        setIsPlaying(false);
    }

    const last = Math.max(0, stepCount - 1);
    const atStart = position <= 0;
    const atEnd = position >= last;

    // Advance while playing; stop at the end.
    useEffect(() => {
        if (!isPlaying) return;
        if (position >= last) {
            setIsPlaying(false);
            return;
        }
        const timer = setTimeout(() => setPosition(p => clampStep(p + 1, stepCount)), stepDelayMs(speed));
        return () => clearTimeout(timer);
    }, [isPlaying, position, last, speed, stepCount]);

    const seek = useCallback((next: number) => setPosition(clampStep(next, stepCount)), [stepCount]);
    const play = useCallback(() => {
        if (stepCount <= 1) return;
        setPosition(p => (p >= stepCount - 1 ? 0 : p));
        setIsPlaying(true);
    }, [stepCount]);
    const pause = useCallback(() => setIsPlaying(false), []);
    const togglePlay = useCallback(() => {
        if (isPlaying) pause();
        else play();
    }, [isPlaying, play, pause]);
    const stepBack = useCallback(() => {
        setIsPlaying(false);
        setPosition(p => clampStep(p - 1, stepCount));
    }, [stepCount]);
    const stepForward = useCallback(() => {
        setIsPlaying(false);
        setPosition(p => clampStep(p + 1, stepCount));
    }, [stepCount]);
    const setSpeed = useCallback((next: number) => setSpeedState(REPLAY_SPEEDS.includes(next) ? next : 1), []);

    return { position, isPlaying, speed, atStart, atEnd, play, pause, togglePlay, stepBack, stepForward, seek, setSpeed };
}
