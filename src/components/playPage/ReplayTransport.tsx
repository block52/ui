import React from "react";
import { FaBackward, FaForward, FaPause, FaPlay, FaStepBackward, FaStepForward } from "react-icons/fa";
import { REPLAY_SPEEDS } from "../../utils/replayTimeline";

export interface ReplayTransportProps {
    handNumber: number;
    /** The table's latest hand, when known: the top of "skip forward". */
    latestHand: number | null;
    stepCount: number;
    position: number;
    isPlaying: boolean;
    speed: number;
    /** What the shown step is, e.g. "Call · seat 2". */
    stepLabel: string;
    isLoading: boolean;
    error: string | null;
    onTogglePlay: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onSeek: (position: number) => void;
    onSpeed: (speed: number) => void;
    onPrevHand: () => void;
    onNextHand: () => void;
    onGoLive: () => void;
}

const iconButton = "p-2 rounded-full transition-opacity hover:opacity-80 disabled:opacity-30 disabled:hover:opacity-30";

/**
 * Media-player controls for a hand replay (ui#816): skip between the table's
 * hands, play / pause, step, scrub and speed. Replaces the "Viewing hand #N"
 * pill at the bottom of a replay. Pure presentation — the transport state
 * lives in useReplayTransport / useReplayTimeline.
 */
export const ReplayTransport: React.FC<ReplayTransportProps> = ({
    handNumber,
    latestHand,
    stepCount,
    position,
    isPlaying,
    speed,
    stepLabel,
    isLoading,
    error,
    onTogglePlay,
    onStepBack,
    onStepForward,
    onSeek,
    onSpeed,
    onPrevHand,
    onNextHand,
    onGoLive
}) => {
    const hasSteps = stepCount > 0;
    const last = Math.max(0, stepCount - 1);
    return (
        <div
            data-testid="replay-transport"
            // Bottom pill: the table header (also z-[100], later in the DOM) covered a
            // top banner, and replay mode has no action panel down here.
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center gap-1 py-2 px-4 text-sm rounded-2xl shadow-lg"
            style={{ background: "rgba(214, 60, 94, 0.95)", color: "#fff", minWidth: "min(520px, calc(100vw - 32px))" }}
        >
            <div className="flex items-center gap-2 w-full">
                <button
                    type="button"
                    className={iconButton}
                    onClick={onPrevHand}
                    disabled={handNumber <= 1}
                    title="Previous hand"
                    aria-label="Previous hand"
                    data-testid="replay-prev-hand"
                >
                    <FaStepBackward size={12} />
                </button>
                <span className="font-semibold whitespace-nowrap" data-testid="replay-hand">
                    Hand #{handNumber}
                    {latestHand !== null && <span className="opacity-80 font-normal"> of {latestHand}</span>}
                </span>
                <button
                    type="button"
                    className={iconButton}
                    onClick={onNextHand}
                    disabled={latestHand !== null && handNumber >= latestHand}
                    title="Next hand"
                    aria-label="Next hand"
                    data-testid="replay-next-hand"
                >
                    <FaStepForward size={12} />
                </button>
                <span className="mx-1 opacity-50">|</span>
                <button type="button" className={iconButton} onClick={onStepBack} disabled={!hasSteps || position <= 0} title="Step back" aria-label="Step back" data-testid="replay-step-back">
                    <FaBackward size={12} />
                </button>
                <button
                    type="button"
                    className={`${iconButton} bg-white/20`}
                    onClick={onTogglePlay}
                    disabled={stepCount <= 1}
                    title={isPlaying ? "Pause" : "Play"}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    data-testid="replay-play"
                >
                    {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} />}
                </button>
                <button type="button" className={iconButton} onClick={onStepForward} disabled={!hasSteps || position >= last} title="Step forward" aria-label="Step forward" data-testid="replay-step-forward">
                    <FaForward size={12} />
                </button>
                <select
                    value={speed}
                    onChange={e => onSpeed(Number(e.target.value))}
                    className="ml-1 rounded px-1 py-0.5 text-xs text-white bg-white/20 border-0"
                    title="Playback speed"
                    aria-label="Playback speed"
                    data-testid="replay-speed"
                >
                    {REPLAY_SPEEDS.map(s => (
                        <option key={s} value={s} className="text-black">
                            {s}×
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={onGoLive}
                    className="ml-auto px-3 py-1 rounded text-xs font-bold transition-opacity hover:opacity-80 whitespace-nowrap"
                    style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
                >
                    Go Live
                </button>
            </div>
            <div className="flex items-center gap-2 w-full text-xs">
                <input
                    type="range"
                    min={0}
                    max={last}
                    value={hasSteps ? position : 0}
                    onChange={e => onSeek(Number(e.target.value))}
                    disabled={!hasSteps}
                    className="flex-1 accent-white"
                    aria-label="Replay position"
                    data-testid="replay-seek"
                />
                <span className="whitespace-nowrap opacity-90" data-testid="replay-step">
                    {error ? error : isLoading ? "Loading replay…" : hasSteps ? `Step ${position + 1} / ${stepCount} · ${stepLabel}` : "Final state (read-only)"}
                </span>
            </div>
        </div>
    );
};
