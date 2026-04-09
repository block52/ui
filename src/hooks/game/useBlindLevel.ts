import { useState, useEffect, useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { isSitAndGoFormat, isTournamentFormat } from "../../utils/gameFormatUtils";
import { formatChipCount } from "../../utils/potDisplayUtils";

export interface BlindLevelInfo {
    /** Current blind level (0-based) */
    level: number;
    /** Current small blind (chip count) */
    smallBlind: number;
    /** Current big blind (chip count) */
    bigBlind: number;
    /** Next level's small blind */
    nextSmallBlind: number;
    /** Next level's big blind */
    nextBigBlind: number;
    /** Formatted current blinds string (e.g., "50 / 100") */
    currentBlindsFormatted: string;
    /** Formatted next blinds string (e.g., "100 / 200") */
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
 * Hook that computes blind level information for SNG/Tournament games.
 *
 * Derives the current level from the doubling formula used by the PVM's
 * SitAndGoBlindsManager: blinds = initialBlinds * 2^level
 *
 * The timer countdown requires a game start time. Pass `startTime` (epoch ms)
 * when the PVM exposes it in the game state DTO. Until then, the timer
 * shows as unavailable.
 *
 * @param startTime - Optional epoch ms when the game started (for timer)
 */
export const useBlindLevel = (startTime?: number): BlindLevelInfo => {
    const { gameState, gameFormat } = useGameStateContext();
    const [now, setNow] = useState<number>(0);

    const isActive = isSitAndGoFormat(gameFormat) || isTournamentFormat(gameFormat);

    const gameOptions = gameState?.gameOptions;
    const sbRaw = gameOptions?.smallBlind;
    const bbRaw = gameOptions?.bigBlind;
    const blindLevelDuration = gameOptions?.blindLevelDuration;
    const startingStackRaw = gameOptions?.startingStack;

    // Current blinds from chain (already escalated by PVM)
    const currentSB = sbRaw ? Number(sbRaw) : 0;
    const currentBB = bbRaw ? Number(bbRaw) : 0;

    // Blind level duration in seconds
    const levelDurationSeconds = blindLevelDuration ? blindLevelDuration * 60 : 0;

    // Derive the initial small blind from the starting stack.
    // For doubling progression: level = log2(currentSB / initialSB)
    // Common convention: initial SB = startingStack / 40 (gives ~20BB starting)
    const initialSB = useMemo(() => {
        if (!startingStackRaw || currentSB === 0) return currentSB;
        const startingStack = Number(startingStackRaw);
        return Math.max(1, Math.floor(startingStack / 40));
    }, [startingStackRaw, currentSB]);

    // Calculate current level from the doubling formula
    const level = useMemo(() => {
        if (!isActive || initialSB === 0 || currentSB === 0) return 0;
        if (currentSB <= initialSB) return 0;
        const ratio = currentSB / initialSB;
        return Math.max(0, Math.round(Math.log2(ratio)));
    }, [isActive, currentSB, initialSB]);

    // Next level blinds (double current)
    const nextSmallBlind = currentSB * 2;
    const nextBigBlind = currentBB * 2;

    // Timer: compute seconds remaining in current level
    const hasTimer = isActive && levelDurationSeconds > 0 && startTime !== undefined && startTime > 0;

    const secondsRemaining = useMemo(() => {
        if (!hasTimer || !startTime) return -1;
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
        : `${formatChipCount(currentSB)} / ${formatChipCount(currentBB)}`;

    const nextBlindsFormatted = `${formatChipCount(nextSmallBlind)} / ${formatChipCount(nextBigBlind)}`;

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
