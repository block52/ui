import { ActionDTO, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { formatPlayerId, formatAmount } from "../utils/accountUtils";
import { WinnerInfo } from "../types/index";

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
    const amount = action.amount ? ` ${formatAmount(action.amount, undefined, isTournament)}` : "";
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
        && Array.isArray(winnerInfo)
        && winnerInfo.length > 0;
};
