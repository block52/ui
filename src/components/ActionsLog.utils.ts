import { ActionDTO, NonPlayerActionType, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { formatPlayerId, formatAmount } from "../utils/accountUtils";
import { WinnerInfo } from "../types/index";
import { hasElements } from "../utils/guards";

/**
 * Actions whose amounts are MONETARY (USDC micro-units) even in tournaments:
 * join carries the buy-in paid, leave the stack/prize taken out, top-up the
 * chips purchased. Everything ELSE in an SNG/tournament (blinds, bets, raises,
 * calls) is tournament chips. Formatting these by game format alone labelled an
 * SNG's 100,000 µUSDC ($0.10) buy-in as "100,000 chips" next to a 1,500-chip
 * starting stack (ui#660).
 */
const MONETARY_ACTIONS = new Set<string>([NonPlayerActionType.JOIN, NonPlayerActionType.LEAVE, NonPlayerActionType.TOP_UP]);

export const formatActionName = (action: string): string => {
    switch (action.toLowerCase()) {
        case "join":
            return "Join";
        case "post-small-blind":
            return "Post Small Blind";
        case "post-big-blind":
            return "Post Big Blind";
        case "deal":
            return "Deal";
        case "call":
            return "Call";
        case "check":
            return "Check";
        case "bet":
            return "Bet";
        case "raise":
            return "Raise";
        case "fold":
            return "Fold";
        case "show":
            return "Show";
        case "muck":
            return "Muck";
        case "all-in":
            return "All In";
        case "leave":
            return "Leave";
        case "sit-out":
            return "Sit Out";
        case "sit-in":
            return "Sit In";
        case "new-hand":
            return "New Hand";
        default:
            return action.charAt(0).toUpperCase() + action.slice(1).replace(/-/g, " ");
    }
};

export const formatRoundName = (round: string): string => {
    switch (round.toLowerCase()) {
        case "ante":
            return "Ante";
        case "preflop":
            return "Pre-flop";
        case "flop":
            return "Flop";
        case "turn":
            return "Turn";
        case "river":
            return "River";
        case "showdown":
            return "Showdown";
        case "end":
            return "End";
        default:
            return round.charAt(0).toUpperCase() + round.slice(1);
    }
};

export const getActionLine = (action: ActionDTO, isTournament: boolean): string => {
    const player = formatPlayerId(action.playerId);
    const actionName = formatActionName(action.action);
    // Monetary actions format as USDC regardless of game format (ui#660).
    const asChips = isTournament && !MONETARY_ACTIONS.has(action.action);
    const amount = action.amount ? ` ${formatAmount(action.amount, undefined, asChips)}` : "";
    const round = formatRoundName(action.round);
    return `${player} (Seat ${action.seat}): ${actionName}${amount} - ${round}`;
};

export const getWinnerLine = (winner: WinnerInfo): string => {
    const player = formatPlayerId(winner.address);
    const hand = winner.description ? `${winner.description} — ` : "";
    return `${player} (Seat ${winner.seat}): WINS ${hand}${winner.formattedAmount}`;
};

export const shouldShowWinnerSummary = (
    gameState: TexasHoldemStateDTO | null | undefined,
    winnerInfo: WinnerInfo[] | null | undefined
): boolean => {
    return gameState?.round === TexasHoldemRound.END
        && hasElements(winnerInfo);
};
