export type SeatBannerMode = "winner" | "action" | "seat-join" | "timer" | "hidden";

/**
 * What a seat's banner shows, most important first:
 *
 *   1. The winner.
 *   2. The countdown, when this seat is on the clock (ui#944). The badge for the
 *      seat's last move must not cover it: when the same player acts again, like
 *      the big blind checking and then going first on the flop, their new clock
 *      was hidden behind "CHECK" for about 3 seconds.
 *   3. The action badge.
 *   4. The seat-join notice.
 *   5. The status line (seated, sitting out, folded, all in), or nothing.
 */
export const seatBannerMode = (args: {
    isWinner: boolean;
    isOnTheClock: boolean;
    hasActionBadge: boolean;
    hasSeatJoinNotice: boolean;
    hasStatusLine: boolean;
}): SeatBannerMode => {
    if (args.isWinner) return "winner";
    if (args.isOnTheClock) return "timer";
    if (args.hasActionBadge) return "action";
    if (args.hasSeatJoinNotice) return "seat-join";
    return args.hasStatusLine ? "timer" : "hidden";
};
