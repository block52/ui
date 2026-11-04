/**
 * Upcoming Sit & Go schedule utilities.
 *
 * The schedule is a set of *weekly recurring* tournaments defined in
 * `public/sng-schedule.json` (fetched at runtime). Each entry names a
 * day-of-week + wall-clock time in an IANA timezone (e.g. Australia/Sydney).
 * These helpers compute the next UTC instant each tournament fires, so the UI
 * can display the start time in UTC and count down to it in the viewer's local
 * time.
 *
 * All timezone math goes through `Intl.DateTimeFormat` — no hardcoded offsets —
 * so daylight-saving transitions (AEST↔AEDT) are handled correctly.
 */

import { hasContent, isNumber, isRecord, isString } from "./guards";

/** A weekly recurring Sit & Go, as defined in the remote JSON schedule. */
export interface SngTournament {
    /** Stable identifier, e.g. "tuesday-10". */
    id: string;
    /** Display name, e.g. "$10 Tuesday". */
    name: string;
    /** Buy-in display label, e.g. "$10". */
    buyIn: string;
    /** Day of week the tournament runs. 0 = Sunday … 6 = Saturday. */
    dayOfWeek: number;
    /** Start hour (0-23), wall-clock in `timeZone`. */
    hour: number;
    /** Start minute (0-59), wall-clock in `timeZone`. */
    minute: number;
    /** IANA timezone the wall-clock time is expressed in, e.g. "Australia/Sydney". */
    timeZone: string;
    /** URL players follow to register / join this tournament. */
    link: string;
}

/** A tournament plus the resolved UTC instant of its next occurrence. */
export interface UpcomingSng extends SngTournament {
    /** Absolute UTC instant when the next occurrence starts. */
    nextStart: Date;
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
};

const MS_PER_DAY = 86_400_000;

/**
 * Offset (in ms) of `timeZone` from UTC at the given instant. Positive east of
 * UTC (e.g. Australia/Sydney returns +36e6 in AEST, +39.6e6 in AEDT).
 */
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).formatToParts(date);

    const map: Record<string, number> = {};
    for (const part of parts) {
        if (part.type !== "literal") map[part.type] = Number(part.value);
    }

    // Interpret the wall-clock parts as if they were UTC, then diff against the
    // real instant to recover the offset.
    const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour % 24, map.minute, map.second);
    return asUtc - date.getTime();
}

/** Calendar year/month/day of `date` as observed in `timeZone`. */
function getZonedYmd(timeZone: string, date: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const map: Record<string, number> = {};
    for (const part of parts) {
        if (part.type !== "literal") map[part.type] = Number(part.value);
    }
    return { year: map.year, month: map.month, day: map.day };
}

/** Day of week (0 = Sunday … 6 = Saturday) of `date` as observed in `timeZone`. */
export function getZonedWeekday(timeZone: string, date: Date): number {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
    return WEEKDAY_INDEX[weekday];
}

/**
 * Convert a wall-clock time in `timeZone` to the corresponding UTC instant.
 * Two correction passes settle daylight-saving boundary cases.
 */
export function zonedWallTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string
): Date {
    // First guess: pretend the wall time is already UTC.
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    let offset = getTimeZoneOffsetMs(timeZone, new Date(guess));
    let result = guess - offset;
    // Re-measure the offset at the corrected instant (the offset near a DST
    // switch can differ from the one at the guess) and correct once more.
    offset = getTimeZoneOffsetMs(timeZone, new Date(result));
    result = guess - offset;
    return new Date(result);
}

/**
 * The next UTC instant after `now` at which the tournament fires, honouring its
 * weekday + wall-clock time in its timezone.
 */
export function getNextOccurrence(tournament: SngTournament, now: Date): Date {
    // Walk forward day-by-day in the tournament's zone. A 15-day window covers
    // every weekday even across DST-shortened/lengthened days.
    for (let i = 0; i <= 14; i++) {
        const probe = new Date(now.getTime() + i * MS_PER_DAY);
        const { year, month, day } = getZonedYmd(tournament.timeZone, probe);
        const candidate = zonedWallTimeToUtc(year, month, day, tournament.hour, tournament.minute, tournament.timeZone);
        if (candidate.getTime() > now.getTime() && getZonedWeekday(tournament.timeZone, candidate) === tournament.dayOfWeek) {
            return candidate;
        }
    }
    throw new Error(`Could not compute next occurrence for SNG "${tournament.id}"`);
}

/**
 * Resolve the next occurrence of every tournament, sort soonest-first, and
 * return the first `count`.
 */
export function getUpcomingSngs(tournaments: SngTournament[], now: Date, count: number): UpcomingSng[] {
    return tournaments
        .map(tournament => ({ ...tournament, nextStart: getNextOccurrence(tournament, now) }))
        .sort((a, b) => a.nextStart.getTime() - b.nextStart.getTime())
        .slice(0, count);
}

/** Human countdown like "2d 09h 45m 12s" (drops the day segment under 24h). */
export function formatCountdown(msRemaining: number): string {
    if (msRemaining <= 0) return "Starting now";

    const totalSeconds = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");

    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/** Format an instant as a UTC label, e.g. "Tue, 8 Jul, 08:00 UTC". */
export function formatUtcLabel(date: Date): string {
    const formatted = new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).format(date);
    return `${formatted} UTC`;
}

/** Format an instant in the viewer's local timezone, e.g. "Tue, 8 Jul, 18:00". */
export function formatLocalLabel(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

/**
 * Validate and narrow the raw parsed JSON schedule into `SngTournament[]`.
 * Throws on malformed input rather than silently coercing — a broken schedule
 * is an operator error to surface, not to paper over.
 */
export function parseSngSchedule(raw: unknown): SngTournament[] {
    if (!isRecord(raw)) {
        throw new Error("SNG schedule must be a JSON object");
    }
    const tournaments = raw.tournaments;
    if (!Array.isArray(tournaments)) {
        throw new Error("SNG schedule must have a `tournaments` array");
    }

    return tournaments.map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`SNG schedule entry ${index} must be an object`);
        }
        const t = entry;
        const requireString = (field: string): string => {
            const value = t[field];
            if (!isString(value) || !hasContent(value)) {
                throw new Error(`SNG schedule entry ${index} missing string field "${field}"`);
            }
            return value;
        };
        const requireNumber = (field: string, min: number, max: number): number => {
            const value = t[field];
            if (!isNumber(value) || !Number.isInteger(value) || value < min || value > max) {
                throw new Error(`SNG schedule entry ${index} field "${field}" must be an integer in [${min}, ${max}]`);
            }
            return value;
        };

        return {
            id: requireString("id"),
            name: requireString("name"),
            buyIn: requireString("buyIn"),
            dayOfWeek: requireNumber("dayOfWeek", 0, 6),
            hour: requireNumber("hour", 0, 23),
            minute: requireNumber("minute", 0, 59),
            timeZone: requireString("timeZone"),
            link: requireString("link")
        };
    });
}
