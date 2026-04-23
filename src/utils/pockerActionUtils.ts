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
