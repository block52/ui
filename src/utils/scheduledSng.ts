import { NonPlayerActionType, PlayerActionType, isLateRegistrationOpen, lateRegistrationClosesAt, type ActionDTO, type GameOptionsDTO, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { hasValue, isNullish } from "./guards";

/**
 * Scheduled single-table tournaments (poker-vm#2680).
 *
 * A sit-and-go with gameOptions.scheduledStartTime (epoch ms) starts when the
 * table fills OR at that time with at least minPlayers registered (any
 * registered player sends START; the engine offers it in legalActions once it
 * is due). If fewer than minPlayers have registered SCHEDULED_SNG_GRACE_MS after
 * the start time, the table is cancelled: joins are refused and players leave
 * with a refund. These helpers are pure so the lobby and the table page agree.
 */

/** The engine's grace window after a scheduled start before cancellation. */
export const SCHEDULED_SNG_GRACE_MS = 15 * 60 * 1000;

export type ScheduledSngPhase =
    | "unscheduled" // no start time: starts only when the table is full
    | "registering" // before the start time
    | "ready" // start time passed with enough players: START is due
    | "short" // start time passed, too few players, still inside the grace window
    | "cancelled"; // grace window passed with too few players

export interface ScheduledSngInput {
    scheduledStartTime: number | undefined;
    minPlayers: number;
    registered: number;
    nowMs: number;
}

export const isScheduledSng = (options: Pick<GameOptionsDTO, "scheduledStartTime"> | null | undefined): boolean =>
    hasValue(options?.scheduledStartTime) && options.scheduledStartTime > 0;

export const scheduledSngPhase = ({ scheduledStartTime, minPlayers, registered, nowMs }: ScheduledSngInput): ScheduledSngPhase => {
    if (isNullish(scheduledStartTime) || scheduledStartTime <= 0) return "unscheduled";
    if (nowMs < scheduledStartTime) return "registering";
    if (registered >= minPlayers) return "ready";
    if (nowMs < scheduledStartTime + SCHEDULED_SNG_GRACE_MS) return "short";
    return "cancelled";
};

const STARTED_ACTIONS: ReadonlySet<string> = new Set<string>([
    NonPlayerActionType.START,
    PlayerActionType.SMALL_BLIND,
    PlayerActionType.BIG_BLIND
]);

/**
 * Whether the tournament is in play: past the first hand, or hand 1 has been
 * started (START recorded) or a blind has been posted. Once in play the field is
 * frozen and the "waiting for players" state is over, even with empty seats.
 */
export const hasTournamentStarted = (gameState: Pick<TexasHoldemStateDTO, "handNumber" | "previousActions"> | null | undefined): boolean => {
    if (isNullish(gameState)) return false;
    if (gameState.handNumber > 1) return true;
    const actions: ActionDTO[] = Array.isArray(gameState.previousActions) ? gameState.previousActions : [];
    return actions.some(a => STARTED_ACTIONS.has(a.action));
};

/**
 * Whether the tournament is over: the engine has recorded a 1st place in
 * results[]. Busted players get their places as they go out; only the winner's
 * place 1 ends it. Nothing runs on a finished table, so its clocks stop.
 */
export const hasTournamentFinished = (gameState: Pick<TexasHoldemStateDTO, "results"> | null | undefined): boolean => {
    if (isNullish(gameState)) return false;
    return Array.isArray(gameState.results) && gameState.results.some(r => r.place === 1);
};

/** "mm:ss" (or "h:mm:ss") until a time; "0:00" once passed. */
export const formatCountdown = (untilMs: number, nowMs: number): string => {
    const total = Math.max(0, Math.floor((untilMs - nowMs) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
};

/** A short local time, e.g. "20:30" (today) or "Oct 15, 20:30" (another day). */
export const formatStartsAt = (startMs: number, nowMs: number = Date.now()): string => {
    const start = new Date(startMs);
    const now = new Date(nowMs);
    const sameDay = start.toDateString() === now.toDateString();
    const time = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return sameDay ? time : `${start.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

/** datetime-local input value → unix seconds (NaN when empty/invalid). */
export const localDateTimeToUnixSeconds = (value: string): number => {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
};

/**
 * Late registration (poker-vm#2731): a scheduled sit-and-go may keep taking new
 * players after it starts, while the blind level is below
 * gameOptions.lateRegistrationLevels and nobody has finished in the money.
 *
 *   - "none":   no late registration, or the tournament has not started (the
 *               normal registration rules apply);
 *   - "open":   started, and a join would still be accepted;
 *   - "closed": started, and the window has shut.
 */
export type LateRegistrationPhase = "none" | "open" | "closed";

export const lateRegistrationPhase = (
    gameState: Pick<TexasHoldemStateDTO, "gameOptions" | "results" | "handNumber" | "previousActions"> | null | undefined,
    nowMs: number
): LateRegistrationPhase => {
    if (isNullish(gameState) || isNullish(gameState.gameOptions.lateRegistrationLevels) || !hasTournamentStarted(gameState)) return "none";
    return isLateRegistrationOpen(gameState.gameOptions, gameState.results, nowMs) ? "open" : "closed";
};

/** When late registration closes (epoch ms), once the first hand is dealt. */
export const lateRegistrationEndsAt = (options: GameOptionsDTO): number | undefined => lateRegistrationClosesAt(options);

/** "Late reg: 3 levels" for a table with late registration; "" otherwise. */
export const formatLateRegistration = (levels: number | undefined): string =>
    hasValue(levels) && levels > 0 ? `Late reg: ${levels} level${levels === 1 ? "" : "s"}` : "";

/** Late registration choices for a new tournament (poker-vm#2731): 0 = off,
 * else the number of blind levels it stays open after the start. */
export const LATE_REGISTRATION_LEVEL_OPTIONS: readonly number[] = [0, 1, 2, 3, 4, 6];

/** The create form's label for a late-registration choice. */
export const lateRegistrationOptionLabel = (levels: number): string =>
    levels === 0 ? "Off: the field is fixed at the start" : `Open for the first ${levels} blind level${levels === 1 ? "" : "s"}`;
