import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "../../common";
import { insetBoxClass, noticeClass } from "../../modals/walletFormClasses";

interface GameStartCountdownProps {
    gameStartTime: string; // ISO string or date string in Brisbane time
    onCountdownComplete: () => void;
    onSkip?: () => void; // Optional skip function for testing
}

const GameStartCountdown: React.FC<GameStartCountdownProps> = ({ gameStartTime, onCountdownComplete, onSkip: _onSkip }) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        total: number;
    }>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });

    const [isVisible, setIsVisible] = useState(false);

    const calculateTimeLeft = useCallback(() => {
        try {
            // Parse the game start time (assume it's in Brisbane time)
            const gameDate = new Date(gameStartTime);

            // Convert to Brisbane time (UTC+10, or UTC+11 during daylight saving)
            // For simplicity, we'll use UTC+10. In production, you'd want proper timezone handling
            const now = new Date();
            const brisbaneOffset = 10 * 60; // Brisbane is UTC+10
            const localOffset = now.getTimezoneOffset();
            const brisbaneTime = new Date(now.getTime() + (brisbaneOffset + localOffset) * 60000);

            const difference = gameDate.getTime() - brisbaneTime.getTime();

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                return { days, hours, minutes, seconds, total: difference };
            }

            return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
        } catch (error) {
            console.error("Error calculating time left:", error);
            return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
        }
    }, [gameStartTime]);

    useEffect(() => {
        const updateCountdown = () => {
            const newTimeLeft = calculateTimeLeft();
            setTimeLeft(newTimeLeft);

            if (newTimeLeft.total <= 0) {
                setIsVisible(false);
                onCountdownComplete();
            } else {
                setIsVisible(true);
            }
        };

        // Initial calculation
        updateCountdown();

        // Set up interval to update every second
        const timer = setInterval(updateCountdown, 1000);

        return () => clearInterval(timer);
    }, [calculateTimeLeft, onCountdownComplete]);

    // Don't render if countdown is complete
    if (!isVisible) {
        return null;
    }

    const formatTime = (value: number) => value.toString().padStart(2, "0");

    const units: ReadonlyArray<{ label: string; value: number; pulse?: boolean }> = [
        { label: "Days", value: timeLeft.days },
        { label: "Hours", value: timeLeft.hours },
        { label: "Mins", value: timeLeft.minutes },
        { label: "Secs", value: timeLeft.seconds, pulse: true }
    ];

    return (
        <Modal isOpen onClose={noop} closeOnEscape={false} closeOnBackdropClick={false} widthClass="w-[420px]">
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/30 grid place-items-center text-brand-light">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="m-0 mt-4 text-xl font-semibold text-ink">Game Starting Soon</h2>
                <p className="m-0 mt-1 text-sm text-ink-muted">Please wait for the scheduled game to begin</p>
            </div>

            {/* Countdown Display */}
            <div className="grid grid-cols-4 gap-2 mt-5" role="timer" aria-live="off">
                {units.map(unit => (
                    <div key={unit.label} className="text-center px-1 py-3 rounded-xl bg-surface-raised border border-line">
                        <div className={`text-2xl font-bold font-mono tabular-nums text-ink ${unit.pulse ? "animate-pulse" : ""}`}>
                            {formatTime(unit.value)}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted">{unit.label}</div>
                    </div>
                ))}
            </div>

            {/* Game Start Time Display */}
            <div className={`${insetBoxClass} mt-3 text-center`}>
                <div className="text-[10px] uppercase tracking-[0.08em] text-ink-muted mb-1">Game starts at (Brisbane time)</div>
                <div className="text-ink font-mono text-sm tabular-nums">
                    {new Date(gameStartTime).toLocaleString("en-AU", {
                        timeZone: "Australia/Brisbane",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    })}
                </div>
            </div>

            {/* Alpha Testing Message */}
            <div className={`${noticeClass.info} mt-3 text-center`}>
                <div className="text-brand-light font-semibold mb-0.5 uppercase tracking-[0.08em]">Alpha testing</div>
                This timer helps coordinate testers to begin together while we iron out bugs
            </div>

            <p className="m-0 mt-4 text-center text-xs text-ink-muted">Scheduled Tournament Start</p>
        </Modal>
    );
};

// Not dismissable by backdrop/Escape; satisfies Modal's required onClose.
function noop(): void {
    return undefined;
}

export default GameStartCountdown;
