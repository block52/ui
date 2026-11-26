/**
 * Late registration for multi-table tournaments (ui#1000, poker-vm#2724/#2800).
 *
 * An organiser keeps registration open past the scheduled start, through the end
 * of blind level N, and players may join while it is open. This mirrors the
 * single-table option (`lateRegistrationLevels`, poker-vm#2731) that
 * `scheduledSng.ts` already drives; the name and meaning are the same.
 *
 * These helpers are pure so the create form, the lobby card, the register
 * modal and the tournament page agree. The create-form choice (default 15) and
 * the cut-off preview come from the blind structure; once the tournament runs,
 * `lateRegistrationWindow` reads the SDK's engine-mirroring helpers
 * (`isTournamentLateRegistrationOpen` / `tournamentLateRegistrationClosesAt`),
 * because the engine is the authority on when the window shuts (it also closes
 * at the first paid place and while the final table forms).
 */
import {
    expandBlindLevel,
    isTournamentLateRegistrationOpen,
    tournamentLateRegistrationClosesAt,
    type BlindStructureDTO,
    type ResultDTO,
    type TournamentOptionsDTO,
    type TournamentStatus
} from "@block52/poker-vm-sdk";
import { hasValue, isNullish } from "@block52/ui-sdk/helpers";

/**
 * The create form's default: open for the first 15 blind levels. The field
 * still accepts any positive number, or 0 for off (ui#1000 item 1).
 */
export const DEFAULT_TOURNAMENT_LATE_REGISTRATION_LEVELS = 15;

/** A tournament's late-registration choice is valid when it is off (0) or a positive whole number of levels. */
export const isValidLateRegistrationLevels = (levels: number): boolean => Number.isSafeInteger(levels) && levels >= 0;

/**
 * Minutes from the first hand until late registration closes: the sum of the
 * durations of levels 0..N-1 (the window shuts at the end of level N). Undefined
 * when there is no late registration (levels <= 0). A break level still consumes
 * its minutes, so the end-of-level-N wall-clock is honest.
 */
export const lateRegistrationDurationMinutes = (structure: BlindStructureDTO, levels: number): number | undefined => {
    if (!isValidLateRegistrationLevels(levels) || levels <= 0) return undefined;
    let minutes = 0;
    for (let n = 0; n < levels; n++) minutes += expandBlindLevel(structure, n).durationMinutes;
    return minutes;
};

/**
 * The cut-off time (epoch ms) late registration reaches, given the scheduled
 * start: the start plus the duration of the first N levels. Undefined when there
 * is no late registration, or the start is not known. This is the create form's
 * preview; the engine's clock runs from the first deal, so the live close time on
 * a running tournament comes from the tournament state, not this.
 */
export const lateRegistrationCutoffAt = (structure: BlindStructureDTO, levels: number, scheduledStartMs: number | undefined): number | undefined => {
    const minutes = lateRegistrationDurationMinutes(structure, levels);
    if (isNullish(minutes) || isNullish(scheduledStartMs)) return undefined;
    return scheduledStartMs + minutes * 60 * 1000;
};

/**
 * The create form's label for a late-registration choice, matching the
 * single-table wording (scheduledSng.ts `lateRegistrationOptionLabel`).
 */
export const tournamentLateRegistrationLabel = (levels: number): string =>
    isValidLateRegistrationLevels(levels) && levels > 0
        ? `Open for the first ${levels} blind level${levels === 1 ? "" : "s"}`
        : "Off: the field is fixed at the start";

/**
 * The lobby card's late-registration line (ui#1000 item 2). `closed` is what the
 * UI learns from the tournament state once the engine has shut the window;
 * before the state says so, the card shows the configured target level. Empty
 * string when the tournament has no late registration.
 */
export const formatTournamentLateRegistration = (levels: number | undefined, closed: boolean): string => {
    if (!hasValue(levels) || !isValidLateRegistrationLevels(levels) || levels <= 0) return "";
    return closed ? "Late reg closed" : `Late reg: until level ${levels}`;
};

/** The part of a tournament record the late-registration window is read from; the SDK's TournamentStateDTO and the lobby's view both fit. */
export interface LateRegistrationSubject {
    status: TournamentStatus;
    options: TournamentOptionsDTO;
    /** When the first hand was dealt, epoch ms. Present once the tournament has started. */
    startedAt?: number;
    results?: ResultDTO[];
}

export interface LateRegistrationWindow {
    /** A registration sent now would be accepted on a running tournament. */
    open: boolean;
    /** The end of the last open level, epoch ms; undefined when there is no late registration or the clock has not started. */
    closesAtMs?: number;
}

/**
 * Whether a running tournament still takes late entrants, read through the SDK
 * helpers so the UI shows what the engine decides (ui#1000 item 5). The engine
 * also shuts the window while the final table forms; that is only visible on
 * the tables, so the chain's refusal is shown if a late registration races it.
 * A tournament that is not running has no late window: before the start the
 * ordinary registration applies, afterwards it is over.
 */
export const lateRegistrationWindow = (t: LateRegistrationSubject, nowMs: number): LateRegistrationWindow => {
    if (t.status !== "running" || isNullish(t.startedAt)) return { open: false };
    const closesAtMs = tournamentLateRegistrationClosesAt(t.options, t.startedAt);
    return {
        open: isTournamentLateRegistrationOpen(t.options, t.startedAt, t.results ?? [], nowMs),
        ...(isNullish(closesAtMs) ? {} : { closesAtMs })
    };
};

const clockTime = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The line for a tournament that has started and had late registration:
 * "Late registration open until level 15 · 21:40", or "Late reg closed". Empty
 * when the tournament never offered it.
 */
export const formatRunningLateRegistration = (levels: number | undefined, window: LateRegistrationWindow): string => {
    if (!hasValue(levels) || !isValidLateRegistrationLevels(levels) || levels <= 0) return "";
    if (!window.open) return "Late reg closed";
    return hasValue(window.closesAtMs) ? `Late registration open until level ${levels} · ${clockTime(window.closesAtMs)}` : `Late registration open until level ${levels}`;
};
