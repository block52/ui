import { useState, useEffect, useMemo } from "react";
import type { BlindStructureDTO } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { isSitAndGoFormat, isTournamentFormat } from "../../utils/gameFormatUtils";
import { formatChipCount } from "../../utils/potDisplayUtils";
import { hasContent, hasValue, isNullish } from "../../utils/guards";
import { hasTournamentFinished } from "../../utils/scheduledSng";

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
    /**
     * Seconds remaining in the current blind level. Negative while a hand runs
     * past the level end (overtime); -1 when unknown (no timer — gated by
     * hasTimer before display).
     */
    secondsRemaining: number;
    /** Duration of each blind level in seconds */
    levelDurationSeconds: number;
    /** Whether this is a tournament-style game with blind levels */
    isActive: boolean;
    /** Whether we have enough data to show the timer (false once the tournament has finished) */
    hasTimer: boolean;
    /**
     * The table's blind structure (a preset or a concrete structure), when it was
     * created with one; undefined means the blinds simply double every level.
     */
    blindStructure?: BlindStructureDTO;
}

/**
 * Hook that reads blind level information from the backend game state
 * for SNG/Tournament games.
 *
 * The level, current blinds, next blinds, and the level start time all come
 * from the PVM via GameOptionsDTO. The timer countdown requires levelStartTime.
 */
export const useBlindLevel = (): BlindLevelInfo => {
    const { gameState, gameFormat } = useGameStateContext();
    const [now, setNow] = useState<number>(0);

    const isActive = isSitAndGoFormat(gameFormat) || isTournamentFormat(gameFormat);

    const gameOptions = gameState?.gameOptions;

    // Epoch ms when the current blind level started (for the countdown).
    // Read directly off gameOptions — useGameOptions() does not surface this field.
    const startTime = gameOptions?.levelStartTime;

    // Current blinds from backend (already escalated by PVM)
    const currentSB = gameOptions?.smallBlind ? Number(gameOptions.smallBlind) : 0;
    const currentBB = gameOptions?.bigBlind ? Number(gameOptions.bigBlind) : 0;

    // Blind level from backend
    const level = gameOptions?.blindLevel;

    // Next blinds from backend — required for SNG/Tournament games
    if (isActive && hasValue(gameOptions)) {
        if (!hasContent(gameOptions.nextSmallBlind)) {
            throw new Error("gameOptions.nextSmallBlind is required for SNG/Tournament games");
        }
        if (!hasContent(gameOptions.nextBigBlind)) {
            throw new Error("gameOptions.nextBigBlind is required for SNG/Tournament games");
        }
    }
    const nextSmallBlind = hasContent(gameOptions?.nextSmallBlind) ? Number(gameOptions.nextSmallBlind) : 0;
    const nextBigBlind = hasContent(gameOptions?.nextBigBlind) ? Number(gameOptions.nextBigBlind) : 0;

    // Blind level duration in seconds
    const blindLevelDuration = gameOptions?.blindLevelDuration;
    const levelDurationSeconds = blindLevelDuration ? blindLevelDuration * 60 : 0;

    // Timer: compute seconds remaining in current level. A finished tournament
    // has no next level: levelStartTime stops advancing, so without this the
    // countdown would run on into red overtime forever.
    const isFinished = hasTournamentFinished(gameState);
    const hasTimer = isActive && !isFinished && levelDurationSeconds > 0 && hasValue(startTime) && startTime > 0;

    const secondsRemaining = useMemo(() => {
        if (!hasTimer || !startTime || isNullish(level)) return -1;
        // `startTime` is the CURRENT level's start (callers pass
        // gameOptions.levelStartTime), so the remaining time is simply the level
        // duration minus the time elapsed within this level. The old formula used
        // (level + 1) * levelDurationSeconds — a cumulative-from-game-start end —
        // which over-counted by level * duration (e.g. a 3-min level showed ~5.5
        // min at level 1, ~8.5 min at level 2) and never reset. (poker-vm#2292)
        // Do NOT clamp to 0: while a hand is still in progress past the level
        // end, the backend holds levelStartTime steady, so this goes negative —
        // the UI shows that overtime in red (e.g. -0:10). Once the hand
        // completes the backend advances levelStartTime and the clock resets to
        // the new level (e.g. 2:50 for a 3-min level that ran 10s over). (poker-vm#2292)
        const elapsedInLevelSeconds = Math.floor((now - startTime) / 1000);
        return levelDurationSeconds - elapsedInLevelSeconds;
    }, [hasTimer, startTime, now, levelDurationSeconds, level]);

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
        hasTimer,
        blindStructure: gameOptions?.blindStructure
    };
};
