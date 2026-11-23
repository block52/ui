import { expandBlindLevel, resolveBlindPreset, type BlindStructureDTO } from "@block52/poker-vm-sdk";
import { formatChipCount } from "@block52/poker-ui-core/utils/potDisplayUtils";
import { isNullish } from "@block52/ui-sdk/helpers";
import type { BlindLevelInfo } from "../hooks/game/useBlindLevel";

/**
 * A single row in the blind-structure ladder shown by the Blinds panel.
 *
 * The ladder is THIS game's schedule, level by level, exactly as the engine
 * plays it: a table created with a blind structure (a preset, a linear /
 * percentage curve or a custom table, ui#860) carries it in
 * `gameOptions.blindStructure`, and the SDK's `expandBlindLevel` gives any
 * level's blinds, ante and length. A table without one doubles its blinds every
 * `blindLevelDuration` minutes, which is the SDK's `double` progression from
 * the starting blinds, recovered as current / 2^level.
 */
export interface BlindLadderRow {
    /** 1-based level number for display, or undefined when the backend has not provided a level index. */
    level: number | undefined;
    /** Small blind (chip count). */
    smallBlind: number;
    /** Big blind (chip count). */
    bigBlind: number;
    /** Big-blind ante (chip count); 0 when there is none. */
    ante: number;
    /** Formatted "SB/BB" string, e.g. "50/100". */
    blindsFormatted: string;
    /** This level's length in minutes, or undefined when unknown. */
    minutes: number | undefined;
    /** A break level: no hands are dealt. */
    isBreak: boolean;
    /** True for a level that has already been played. */
    isPast: boolean;
    /** True for the level currently in play. */
    isCurrent: boolean;
    /** True for the upcoming level. */
    isNext: boolean;
    /**
     * Seconds from now until this level starts, for upcoming levels when the
     * level timer is known; undefined otherwise. Levels change at the first hand
     * boundary after the clock runs out, so this is the earliest start.
     */
    startsInSeconds: number | undefined;
}

export interface BlindLadder {
    rows: BlindLadderRow[];
    /** Whether the whole schedule is known. False falls back to the current and next levels. */
    hasFullSchedule: boolean;
    /** One line describing the schedule, e.g. "Starts 25/50 · doubles every 3 min"; undefined when unknown. */
    summary: string | undefined;
    /** Whether any listed level has an ante (the panel shows the Ante column only then). */
    hasAnte: boolean;
}

/** How many levels past the current one the ladder lists. */
export const BLIND_LEVELS_AHEAD = 12;

/**
 * Format a blind-level countdown as m:ss.
 *
 * Negative input = overtime (the hand is still running past the level end);
 * it is shown with a leading minus, e.g. -0:10. (poker-vm#2292)
 */
export const formatBlindCountdown = (secondsRemaining: number): string => {
    const isOvertime = secondsRemaining < 0;
    const abs = Math.abs(secondsRemaining);
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${isOvertime ? "-" : ""}${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Format the time until a future level starts: "12m", "1h 05m". Rounded up to
 * the minute so a level is never shown as starting sooner than it can.
 */
export const formatLevelStartsIn = (seconds: number): string => {
    const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
};

const minutesFromSeconds = (levelDurationSeconds: number): number | undefined =>
    levelDurationSeconds > 0 ? Math.round(levelDurationSeconds / 60) : undefined;

const formatBlinds = (smallBlind: number, bigBlind: number): string => `${formatChipCount(smallBlind)}/${formatChipCount(bigBlind)}`;

/** The concrete structure the table plays, or undefined when it can't be known. */
const resolveLadderStructure = (info: BlindLevelInfo): Exclude<BlindStructureDTO, { preset: unknown }> | undefined => {
    if (!isNullish(info.blindStructure)) return resolveBlindPreset(info.blindStructure);

    // No structure: the blinds double every level. Recover the starting blinds;
    // the engine's doubled blinds always divide back exactly.
    const level = info.level;
    if (isNullish(level) || info.smallBlind <= 0 || info.bigBlind <= 0) return undefined;
    if (info.nextBigBlind > 0 && info.nextBigBlind !== info.bigBlind * 2) return undefined;
    const factor = 2 ** level;
    if (info.smallBlind % factor !== 0 || info.bigBlind % factor !== 0) return undefined;
    return {
        progression: "double",
        startSmallBlind: String(info.smallBlind / factor),
        startBigBlind: String(info.bigBlind / factor),
        durationMinutes: minutesFromSeconds(info.levelDurationSeconds) ?? 0
    };
};

const describeStructure = (structure: Exclude<BlindStructureDTO, { preset: unknown }>): string => {
    const first = expandBlindLevel(structure, 0);
    const parts = [`Starts ${formatBlinds(Number(first.smallBlind), Number(first.bigBlind))}`];
    if (structure.progression === "table") {
        parts.push("custom levels");
    } else {
        const curve =
            structure.progression === "double"
                ? "doubles"
                : structure.progression === "linear"
                  ? `+${formatChipCount(Number(structure.step))} per level`
                  : `×${structure.factorBps / 10000} per level`;
        parts.push(structure.durationMinutes > 0 ? `${curve} every ${structure.durationMinutes} min` : curve);
        if (structure.ante) parts.push(`ante from level ${structure.ante.startLevel + 1}`);
    }
    return parts.join(" · ");
};

/**
 * Build this game's blind ladder from the data useBlindLevel exposes.
 *
 * With a known structure and level, lists every level from level 1 to
 * `levelsAhead` levels past the current one, marking past / current / next, each
 * with its blinds, ante, length and the time until it starts (the current
 * countdown plus the lengths of the levels in between). Otherwise falls back to
 * the current level and, when the backend gives one, the next. Levels are
 * 1-based for display.
 */
export const buildBlindLadder = (info: BlindLevelInfo, levelsAhead: number = BLIND_LEVELS_AHEAD): BlindLadder => {
    const structure = resolveLadderStructure(info);
    const currentLevel = info.level; // 0-based

    if (!isNullish(structure) && !isNullish(currentLevel)) {
        const rows: BlindLadderRow[] = [];
        let startsIn = info.hasTimer ? Math.max(0, info.secondsRemaining) : undefined;
        for (let n = 0; n <= currentLevel + levelsAhead; n++) {
            const level = expandBlindLevel(structure, n);
            const smallBlind = Number(level.smallBlind);
            const bigBlind = Number(level.bigBlind);
            const stepsAhead = n - currentLevel;
            rows.push({
                level: n + 1,
                smallBlind,
                bigBlind,
                ante: Number(level.ante),
                blindsFormatted: formatBlinds(smallBlind, bigBlind),
                minutes: level.durationMinutes > 0 ? level.durationMinutes : undefined,
                isBreak: level.isBreak,
                isPast: stepsAhead < 0,
                isCurrent: stepsAhead === 0,
                isNext: stepsAhead === 1,
                startsInSeconds: stepsAhead > 0 ? startsIn : undefined
            });
            // The level after this one starts once this one has run its length.
            if (stepsAhead > 0 && !isNullish(startsIn)) startsIn += level.durationMinutes * 60;
        }
        return { rows, hasFullSchedule: true, summary: describeStructure(structure), hasAnte: rows.some(r => r.ante > 0) };
    }

    // Fallback: only what the backend states directly.
    const minutes = minutesFromSeconds(info.levelDurationSeconds);
    const currentLevelDisplay = isNullish(currentLevel) ? undefined : currentLevel + 1;
    const row = (smallBlind: number, bigBlind: number, isNext: boolean): BlindLadderRow => ({
        level: isNullish(currentLevelDisplay) ? undefined : currentLevelDisplay + (isNext ? 1 : 0),
        smallBlind,
        bigBlind,
        ante: 0,
        blindsFormatted: formatBlinds(smallBlind, bigBlind),
        minutes,
        isBreak: false,
        isPast: false,
        isCurrent: !isNext,
        isNext,
        startsInSeconds: isNext && info.hasTimer ? Math.max(0, info.secondsRemaining) : undefined
    });
    const rows = [row(info.smallBlind, info.bigBlind, false)];
    // A zero/zero next means the schedule is flat or unknown; a duplicate row would be noise.
    if (info.nextBigBlind > 0) rows.push(row(info.nextSmallBlind, info.nextBigBlind, true));
    return { rows, hasFullSchedule: false, summary: undefined, hasAnte: false };
};
