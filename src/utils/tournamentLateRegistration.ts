/**
 * Late registration for multi-table tournaments (ui#1000, poker-vm#2724/#2800).
 *
 * An organiser keeps registration open past the scheduled start, through the end
 * of blind level N, and players may join while it is open. This mirrors the
 * single-table option (`lateRegistrationLevels`, poker-vm#2731) that
 * `scheduledSng.ts` already drives; the name and meaning are the same.
 *
 * These helpers are pure so the create form, the lobby card and the register
 * modal agree. They cover the two slices that are buildable before the chain and
 * the SDK ship the MTT half (pokerchain#478, poker-vm#2800):
 *
 *   1. the create form's choice (default 15 levels) and the cut-off time it
 *      implies from the blind structure's level durations;
 *   2. the lobby label ("Late reg: until level N", or "Late reg closed").
 *
 * The join flow, the growing field/prize pool and the places that move down per
 * late entry wait on the tournament-level SDK helpers
 * (`isTournamentLateRegistrationOpen` / `tournamentLateRegistrationClosesAt`,
 * poker-vm#2800): the engine is the authority on when the window actually shuts
 * (it also closes at the first paid place and while the final table forms), so
 * the UI must read that from the tournament state rather than recompute it here.
 */
import { expandBlindLevel, type BlindStructureDTO } from "@block52/poker-vm-sdk";
import { hasValue, isNullish } from "./guards";

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
