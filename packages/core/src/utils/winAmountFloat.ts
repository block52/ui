import { hasContent } from "./guards";

/**
 * Text for the floating win pill on a winning seat (ui#861).
 *
 * @param formattedAmount The seat's won amount from useWinnerInfo: "0.04" for
 *        cash (micro-USDC already converted) or "1,240 chips" for SNG/tournaments
 * @param isTournament Whether the table plays in chips rather than USDC
 * @returns "+$0.04" for cash, "+1,240 chips" for chips, or null when there is
 *          nothing to show
 */
export function winAmountFloatText(formattedAmount: string | null | undefined, isTournament: boolean): string | null {
    if (!hasContent(formattedAmount)) return null;
    return isTournament ? `+${formattedAmount}` : `+$${formattedAmount}`;
}
