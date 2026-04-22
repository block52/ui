import { ActionDTO, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { MAX_ACTION_GROUPS } from "../constants/chips";

/** Action types that place chips on the table */
export const CHIP_ACTIONS: string[] = [
    PlayerActionType.SMALL_BLIND,
    PlayerActionType.BIG_BLIND,
    PlayerActionType.BET,
    PlayerActionType.CALL,
    PlayerActionType.RAISE,
    PlayerActionType.ALL_IN,
];

/**
 * Determine whether a player's chips should be shown on the table
 * based on their current status.
 */
export const shouldShowChips = (status: PlayerStatus): boolean => {
    return (
        status === PlayerStatus.ACTIVE ||
        status === PlayerStatus.ALL_IN ||
        status === PlayerStatus.FOLDED
    );
};

/**
 * Get the relevant chip action amounts for a player in the current round,
 * sorted chronologically and capped to MAX_ACTION_GROUPS (oldest merged).
 *
 * Returns an array of USDC micro-unit amount strings, one per chip group.
 */
export const getRelevantChipAmounts = (
    playerAddress: string,
    currentRound: string,
    previousActions: ActionDTO[]
): string[] => {
    let relevantActions: ActionDTO[];

    if (currentRound === TexasHoldemRound.ANTE || currentRound === TexasHoldemRound.PREFLOP) {
        // During preflop, include blinds + any preflop actions
        relevantActions = previousActions.filter(a =>
            a.playerId === playerAddress &&
            (a.round === TexasHoldemRound.ANTE || a.round === TexasHoldemRound.PREFLOP) &&
            CHIP_ACTIONS.includes(a.action) &&
            a.amount && a.amount !== "0"
        );
    } else {
        // Post-flop: only current round actions
        relevantActions = previousActions.filter(a =>
            a.playerId === playerAddress &&
            a.round === currentRound &&
            CHIP_ACTIONS.includes(a.action) &&
            a.amount && a.amount !== "0"
        );
    }

    // Sort by index (chronological order)
    relevantActions.sort((a, b) => a.index - b.index);

    // Extract amounts
    const amounts = relevantActions.map(a => a.amount);

    // Cap to MAX_ACTION_GROUPS by merging oldest actions into one group
    if (amounts.length > MAX_ACTION_GROUPS) {
        const mergeCount = amounts.length - MAX_ACTION_GROUPS + 1;
        const mergedTotal = amounts.slice(0, mergeCount).reduce(
            (sum, val) => sum + BigInt(val), BigInt(0)
        );
        return [mergedTotal.toString(), ...amounts.slice(mergeCount)];
    }

    return amounts;
};

/**
 * Check if a player has made any betting actions in ANTE/PREFLOP rounds.
 * Used to distinguish between actual bets and buy-in amounts in sumOfBets.
 */
export const hasPlayerBetInRound = (
    playerAddress: string,
    previousActions: ActionDTO[]
): boolean => {
    return previousActions.some(action =>
        action.playerId === playerAddress &&
        (action.round === TexasHoldemRound.ANTE || action.round === TexasHoldemRound.PREFLOP) &&
        CHIP_ACTIONS.includes(action.action) &&
        action.amount && action.amount !== "0"
    );
};

/**
 * Calculate how much a player has bet in the current round only.
 */
export const calculateCurrentRoundBetting = (
    playerAddress: string,
    currentRound: string,
    previousActions: Array<{ playerId: string; round: string; amount?: string }>
): string => {
    const currentRoundActions = previousActions.filter(action =>
        action.playerId === playerAddress &&
        action.round === currentRound &&
        action.amount &&
        action.amount !== "0" &&
        action.amount !== ""
    );

    const totalCurrentRoundBetting = currentRoundActions.reduce((sum, action) => {
        const amount = BigInt(action.amount || "0");
        return sum + amount;
    }, BigInt(0));

    return totalCurrentRoundBetting.toString();
};
