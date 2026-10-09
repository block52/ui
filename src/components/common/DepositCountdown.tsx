import React, { useState, useEffect, useRef } from "react";

const BRIDGE_BLOCKS = 50; // 50 blocks * 12s/block = ~10 minutes total bridge time
const SECONDS_PER_BLOCK = 12;
const TOTAL_SECONDS = BRIDGE_BLOCKS * SECONDS_PER_BLOCK;

interface DepositCountdownProps {
    onComplete?: () => void;
}

export const DepositCountdown: React.FC<DepositCountdownProps> = ({ onComplete }) => {
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Keep onComplete stable — always call the latest version without restarting the interval
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    });

    // Start the interval once on mount
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setSecondsElapsed(prev => {
                if (prev >= TOTAL_SECONDS - 1) {
                    clearInterval(intervalRef.current!);
                    intervalRef.current = null;
                    return TOTAL_SECONDS;
                }
                return prev + 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    // Fire onComplete once the counter reaches the end
    useEffect(() => {
        if (secondsElapsed >= TOTAL_SECONDS) {
            onCompleteRef.current?.();
        }
    }, [secondsElapsed]);

    const blocksConfirmed = Math.floor(secondsElapsed / SECONDS_PER_BLOCK);
    const secondsRemaining = TOTAL_SECONDS - secondsElapsed;
    const minutesLeft = Math.floor(secondsRemaining / 60);
    const secsLeft = secondsRemaining % 60;
    const progress = (secondsElapsed / TOTAL_SECONDS) * 100;

    return (
        <div role="status" className="p-3 rounded-xl border border-brand/25 bg-brand/10">
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-ink-soft text-xs font-semibold">Balance will be available in</span>
                <span className="px-2.5 py-0.5 rounded-full border border-brand/30 bg-brand/15 text-ink text-sm font-semibold font-mono tabular-nums">
                    {minutesLeft}:{secsLeft.toString().padStart(2, "0")}
                </span>
            </div>
            <div className="w-full bg-line rounded-full h-1.5 mb-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <div className="bg-brand h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-center text-xs text-ink-muted tabular-nums">
                Block {blocksConfirmed} / {BRIDGE_BLOCKS} confirmations
            </div>
        </div>
    );
};
