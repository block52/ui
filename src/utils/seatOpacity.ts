import { PlayerStatus } from "@block52/poker-vm-sdk";

/**
 * Tailwind opacity classes used to dim a player's seat/avatar based on how
 * involved they are in the current hand. Exported so tests (and callers) refer
 * to the same literals instead of hard-coding class strings.
 */
export const SEAT_OPACITY = {
    /** Active in the hand, or a winner during showdown — full opacity. */
    FULL: "opacity-100",
    /** Non-winner while someone has won — dimmed hardest. */
    LOST: "opacity-40",
    /** Seated but not in the current hand (seated/sitting-out/sitting-in/busted). */
    IDLE: "opacity-50",
    /** Folded this hand. */
    FOLDED: "opacity-60"
} as const;

export type SeatOpacityClass = (typeof SEAT_OPACITY)[keyof typeof SEAT_OPACITY];

/**
 * Statuses for a player who is seated at the table but NOT part of the current
 * hand, so their seat should read as idle:
 * - SEATED: sat down, not yet dealt in
 * - SITTING_OUT: opted out
 * - SITTING_IN: joined / opted in, waiting to be dealt into the next hand
 * - BUSTED: out of chips
 *
 * Note: ACTIVE, ALL_IN, WAITING_FOR_BIG_BLIND and SHOWING are deliberately NOT
 * here — they are (or are about to be) live in the hand and render at full
 * opacity.
 */
const IDLE_STATUSES: ReadonlySet<PlayerStatus> = new Set([
    PlayerStatus.SEATED,
    PlayerStatus.SITTING_OUT,
    PlayerStatus.SITTING_IN,
    PlayerStatus.BUSTED
]);

export interface SeatOpacityParams {
    /** The player's current status, or undefined when not yet known. */
    status: PlayerStatus | undefined;
    /** Whether any player has won the hand (showdown/payout in progress). */
    hasWinner: boolean;
    /** Whether THIS seat is (one of) the winner(s). */
    isWinner: boolean;
}

/**
 * Resolves the Tailwind opacity class for a player's seat/avatar.
 *
 * Priority:
 * 1. When someone has won, the winner is full opacity and everyone else is
 *    dimmed hardest (LOST).
 * 2. Otherwise a seated-but-not-in-hand player (see {@link IDLE_STATUSES}) is
 *    dimmed to IDLE.
 * 3. A folded player is dimmed to FOLDED.
 * 4. Everyone else (active in the hand, or an unknown/undefined status) renders
 *    at full opacity.
 */
export const getSeatOpacityClass = ({ status, hasWinner, isWinner }: SeatOpacityParams): SeatOpacityClass => {
    if (hasWinner) {
        return isWinner ? SEAT_OPACITY.FULL : SEAT_OPACITY.LOST;
    }
    if (status !== undefined && IDLE_STATUSES.has(status)) {
        return SEAT_OPACITY.IDLE;
    }
    if (status === PlayerStatus.FOLDED) {
        return SEAT_OPACITY.FOLDED;
    }
    return SEAT_OPACITY.FULL;
};
