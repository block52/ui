import { NonPlayerActionType, PlayerActionType, type ActionDTO, type GameOptionsDTO, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
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
