import { hasAction, LegalActionDTO, PlayerActionType, NonPlayerActionType, PlayerDTO } from "@block52/poker-vm-sdk";
import { parseMicroToBigInt } from "../constants/currency";
import { formatDisplayAmount } from "./numberUtils";

export const getTotalPotMicro = (totalPot: string): bigint => parseMicroToBigInt(totalPot);

// Check if the raise amount is valid based on the available actions and their bounds
export const validRaiseAmount = (
    raiseAmount: number,
    hasRaiseAction: boolean,
    hasBetAction: boolean,
    minRaise: number,
    maxRaise: number,
    minBet: number,
    maxBet: number
): boolean => {
    if (hasRaiseAction) return raiseAmount < minRaise || raiseAmount > maxRaise;
    if (hasBetAction) return raiseAmount < minBet || raiseAmount > maxBet;
    return false;
};

// Get the formatted max bet or raise amount based on the action type and game format
export const getFormattedMaxBetAmount = (hasBetAction: boolean, maxBet: number, maxRaise: number, isTournament: boolean): string =>
    formatDisplayAmount(hasBetAction ? maxBet : maxRaise, isTournament);

// Get the initial raise amount based on whether it's a bet or raise action and the minimum amounts
export const getInitialRaiseAmount = (hasBetAction: boolean, minBet: number, minRaise: number): number => {
    if (hasBetAction) return minBet > 0 ? minBet : 0;
    return minRaise > 0 ? minRaise : 0;
};

// Utility function to check if the user is in the table based on their address
export const userInTable = (players: PlayerDTO[] | null, userAddress: string | null | undefined): boolean => {
    if (!players || !userAddress) return false;
    return players.some((player: PlayerDTO) => player.address?.toLowerCase() === userAddress.toLowerCase());
};

// Utility function to get the PlayerDTO for the user based on their address
export const getUserPlayer = (players: PlayerDTO[] | null, userAddress: string | null | undefined): PlayerDTO | null => {
    if (!players || !userAddress) return null;
    return players.find((player: PlayerDTO) => player.address?.toLowerCase() === userAddress.toLowerCase()) || null;
};

/**
 * Whether a legal RAISE is an all-in-only "short shove" — an all-in-only range
 * { min: stack, max: stack } (poker-vm#2353). This arises when the stack exceeds
 * the call but can't make a full min-raise, so the engine offers RAISE only for
 * the whole stack. A min===max range breaks the bet slider (div-by-zero in the
 * fill %), so the FE renders a dedicated ALL-IN button for it and suppresses the
 * normal raise button + slider. A normal (min < max) raise is left to the slider.
 */
export const isShortShoveRaise = (legalActions: LegalActionDTO[], stackMicro: bigint): boolean => {
    if (stackMicro <= 0n) return false;
    const raise = legalActions.find(a => a.action === PlayerActionType.RAISE);
    return !!raise && raise.min === raise.max && parseMicroToBigInt(raise.max) === stackMicro;
};

/**
 * Whether the CALL is a capped all-in call — CALL is the whole stack because the
 * player faces a bet >= their stack, and there is no RAISE (poker-vm#2205/#2353).
 * The normal CALL button already dispatches this (it commits the whole stack);
 * the FE just relabels it "Call (All-In)". No separate action or button.
 */
export const isCappedAllInCall = (legalActions: LegalActionDTO[], stackMicro: bigint): boolean => {
    if (stackMicro <= 0n) return false;
    const raise = legalActions.find(a => a.action === PlayerActionType.RAISE);
    const call = legalActions.find(a => a.action === PlayerActionType.CALL);
    return !raise && !!call && parseMicroToBigInt(call.max) === stackMicro;
};

// Utility function to check if a specific action type is present in the legal actions array
export const getActionFlags = (legalActions: LegalActionDTO[]): ActionFlags => ({
    hasSmallBlindAction: hasAction(legalActions, PlayerActionType.SMALL_BLIND),
    hasBigBlindAction: hasAction(legalActions, PlayerActionType.BIG_BLIND),
    hasFoldAction: hasAction(legalActions, PlayerActionType.FOLD),
    hasCheckAction: hasAction(legalActions, PlayerActionType.CHECK),
    hasCallAction: hasAction(legalActions, PlayerActionType.CALL),
    hasBetAction: hasAction(legalActions, PlayerActionType.BET),
    hasRaiseAction: hasAction(legalActions, PlayerActionType.RAISE),
    hasMuckAction: hasAction(legalActions, PlayerActionType.MUCK),
    hasShowAction: hasAction(legalActions, PlayerActionType.SHOW),
    hasDealAction: hasAction(legalActions, NonPlayerActionType.DEAL),
    hasNewHandAction: hasAction(legalActions, NonPlayerActionType.NEW_HAND)
});

// Whether the showdown SHOW/MUCK bar should render for this seat.
//
// In the sequenced clockwise showdown (poker-vm#2140) the engine offers SHOW/MUCK
// only to the single pending losing-hand player — the one who is nextToAct. A
// forced/auto reveal flips other contesting seats to SHOWING with no recorded
// action, so they are never the actor and must NOT see the bar (ui#697). We also
// hide it the instant this player submits, until the next snapshot confirms the
// new legal actions (ui#678 / #650): controlsPending true ⇒ hidden.
export const shouldShowShowdownBar = (args: {
    hasShowAction: boolean;
    hasMuckAction: boolean;
    isUsersTurn: boolean;
    controlsPending: boolean;
}): boolean => (args.hasShowAction || args.hasMuckAction) && args.isUsersTurn && !args.controlsPending;

export type ActionFlags = {
    hasSmallBlindAction: boolean;
    hasBigBlindAction: boolean;
    hasFoldAction: boolean;
    hasCheckAction: boolean;
    hasCallAction: boolean;
    hasBetAction: boolean;
    hasRaiseAction: boolean;
    hasMuckAction: boolean;
    hasShowAction: boolean;
    hasDealAction: boolean;
    hasNewHandAction: boolean;
};
