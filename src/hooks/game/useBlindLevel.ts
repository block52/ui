import { useState, useEffect, useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { isSitAndGoFormat, isTournamentFormat } from "../../utils/gameFormatUtils";
import { formatChipCount } from "../../utils/potDisplayUtils";

export interface BlindLevelInfo {
    /** Current blind level (0-based), undefined if not provided by backend */
    level: number | undefined;
    /** Current small blind (chip count) */
    smallBlind: number;
    /** Current big blind (chip count) */
    bigBlind: number;
    /** Next level's small blind */
    nextSmallBlind: number;
    /** Next level's big blind */
    nextBigBlind: number;
    /** Formatted current blinds string (e.g., "50/100") */
    currentBlindsFormatted: string;
    /** Formatted next blinds string (e.g., "100/200") */
    nextBlindsFormatted: string;
    /** Seconds remaining until next blind level (-1 if unknown) */
    secondsRemaining: number;
    /** Duration of each blind level in seconds */
    levelDurationSeconds: number;
    /** Whether this is a tournament-style game with blind levels */
    isActive: boolean;
    /** Whether we have enough data to show the timer */
    hasTimer: boolean;
}

/**
 * Hook that reads blind level information from the backend game state
 * for SNG/Tournament games.
 *
 * The level, current blinds, and next blinds all come from the PVM via
 * GameOptionsDTO. The timer countdown requires a game start time.
 *
 * @param startTime - Optional epoch ms when the game started (for timer)
 */
export const useBlindLevel = (startTime?: number): BlindLevelInfo => {
    const { gameState, gameFormat } = useGameStateContext();
    const [now, setNow] = useState<number>(0);

    const isActive = isSitAndGoFormat(gameFormat) || isTournamentFormat(gameFormat);

    const gameOptions = gameState?.gameOptions;

    // Current blinds from backend (already escalated by PVM)
    const currentSB = gameOptions?.smallBlind ? Number(gameOptions.smallBlind) : 0;
    const currentBB = gameOptions?.bigBlind ? Number(gameOptions.bigBlind) : 0;

    // Blind level from backend
    const level = gameOptions?.blindLevel;

    // Next blinds from backend
    const nextSmallBlind = gameOptions?.nextSmallBlind ? Number(gameOptions.nextSmallBlind) : 0;
    const nextBigBlind = gameOptions?.nextBigBlind ? Number(gameOptions.nextBigBlind) : 0;

    // Blind level duration in seconds
    const blindLevelDuration = gameOptions?.blindLevelDuration;
    const levelDurationSeconds = blindLevelDuration ? blindLevelDuration * 60 : 0;

    // Timer: compute seconds remaining in current level
    const hasTimer = isActive && levelDurationSeconds > 0 && startTime !== undefined && startTime > 0;

    const secondsRemaining = useMemo(() => {
        if (!hasTimer || !startTime || level === undefined) return -1;
        const elapsedMs = now - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const currentLevelEndSeconds = (level + 1) * levelDurationSeconds;
        return Math.max(0, currentLevelEndSeconds - elapsedSeconds);
    }, [hasTimer, startTime, now, level, levelDurationSeconds]);

    // Tick the timer every second when active (same pattern as usePlayerTimer)
    useEffect(() => {
        if (!hasTimer) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect -- timer tick pattern, same as usePlayerTimer
        setNow(Date.now());

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [hasTimer]);

    // Formatted strings
    const currentBlindsFormatted = currentSB === 0 && currentBB === 0
        ? ""
        : `${formatChipCount(currentSB)}/${formatChipCount(currentBB)}`;

    const nextBlindsFormatted = `${formatChipCount(nextSmallBlind)}/${formatChipCount(nextBigBlind)}`;

    return {
        level,
        smallBlind: currentSB,
        bigBlind: currentBB,
        nextSmallBlind,
        nextBigBlind,
        currentBlindsFormatted,
        nextBlindsFormatted,
        secondsRemaining,
        levelDurationSeconds,
        isActive,
        hasTimer
    };
};
