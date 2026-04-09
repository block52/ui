import React, { useMemo } from "react";
import { BlindLevelInfo } from "../../../../hooks/game/useBlindLevel";
import styles from "./BlindLevelDisplay.module.css";

interface BlindLevelDisplayProps {
    blindLevel: BlindLevelInfo;
}

/**
 * Formats seconds into MM:SS display string.
 */
function formatCountdown(seconds: number): string {
    if (seconds < 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * BlindLevelDisplay - Shows blind level info for SNG/Tournament games.
 *
 * Displays:
 * - Current level number
 * - Current blinds
 * - Next blinds preview
 * - Countdown timer to next level (when startTime is available)
 *
 * Only renders for tournament-style games (SNG/Tournament).
 * Hidden for cash games.
 */
export const BlindLevelDisplay: React.FC<BlindLevelDisplayProps> = ({ blindLevel }) => {
    const {
        level,
        currentBlindsFormatted,
        nextBlindsFormatted,
        secondsRemaining,
        isActive,
        hasTimer
    } = blindLevel;

    // Timer urgency states for visual feedback
    const timerUrgency = useMemo(() => {
        if (!hasTimer || secondsRemaining < 0) return "none";
        if (secondsRemaining <= 30) return "critical";
        if (secondsRemaining <= 60) return "warning";
        return "normal";
    }, [hasTimer, secondsRemaining]);

    if (!isActive || !currentBlindsFormatted) {
        return null;
    }

    return (
        <div className={styles.container}>
            {/* Level badge */}
            <div className={styles.levelBadge}>
                <span className={styles.levelLabel}>Lvl</span>
                <span className={styles.levelNumber}>{level + 1}</span>
            </div>

            {/* Current blinds */}
            <div className={styles.blindsSection}>
                <span className={styles.currentBlinds}>{currentBlindsFormatted}</span>
                <span className={styles.nextBlinds}>
                    <span className={styles.arrow}>&rarr;</span> {nextBlindsFormatted}
                </span>
            </div>

            {/* Timer */}
            {hasTimer && (
                <div
                    className={`${styles.timer} ${
                        timerUrgency === "critical"
                            ? styles.timerCritical
                            : timerUrgency === "warning"
                            ? styles.timerWarning
                            : styles.timerNormal
                    }`}
                >
                    <span className={styles.timerValue}>{formatCountdown(secondsRemaining)}</span>
                </div>
            )}
        </div>
    );
};
