import { ActionDTO, PlayerActionType, PlayerDTO, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { MAX_ACTION_GROUPS } from "../constants/chips";
import { hasContent } from "./guards";

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
 * Sum of a player's actual bet-placing actions in the current round.
 *
 * Excludes non-bet actions (TOP_UP, JOIN, LEAVE, FOLD, CHECK, etc.) so that
 * a mid-hand top-up by a folded player never renders as chips in front of
 * them. See block52/poker-vm#2141 and block52/ui#279.
 */
export const calculateCurrentRoundBetting = (
    playerAddress: string,
    currentRound: string,
    previousActions: ActionDTO[]
): string => {
    const currentRoundActions = previousActions.filter(action =>
        action.playerId === playerAddress &&
        action.round === currentRound &&
        CHIP_ACTIONS.includes(action.action) &&
        hasContent(action.amount) &&
        action.amount !== "0"
    );

    const totalCurrentRoundBetting = currentRoundActions.reduce((sum, action) => {
        const amount = BigInt(action.amount || "0");
        return sum + amount;
    }, BigInt(0));

    return totalCurrentRoundBetting.toString();
};

/**
 * A player's total chips committed in the CURRENT betting round, blind-aware.
 *
 * Preflop, blinds post in the ANTE round but stay live for preflop betting, so
 * ANTE + PREFLOP chip actions are summed together (mirrors getRelevantChipAmounts
 * / usePlayerChipData). Postflop, only the current round counts. Returns micro
 * units as a bigint.
 */
export const currentRoundContribution = (
    playerAddress: string,
    currentRound: string,
    previousActions: ActionDTO[]
): bigint => {
    const isPreflop =
        currentRound === TexasHoldemRound.ANTE || currentRound === TexasHoldemRound.PREFLOP;
    return previousActions
        .filter(a =>
            a.playerId === playerAddress &&
            (isPreflop
                ? a.round === TexasHoldemRound.ANTE || a.round === TexasHoldemRound.PREFLOP
                : a.round === currentRound) &&
            CHIP_ACTIONS.includes(a.action) &&
            hasContent(a.amount) &&
            a.amount !== "0"
        )
        .reduce((sum, a) => sum + BigInt(a.amount || "0"), BigInt(0));
};

/**
 * True when checking would be free for `address` right now — i.e. no other
 * player has committed more chips than they have in the current betting round.
 *
 * Used to decide whether the pre-select "Check" control (ui#388) should be
 * offered before it is the player's turn. Correctly handles the preflop big
 * blind (their posted BB counts, so they stay "check-free" until someone raises)
 * and non-blind preflop seats (facing the BB → not free).
 */
export const isCheckFreeForPlayer = (
    players: PlayerDTO[] | null,
    address: string | null | undefined,
    currentRound: string | undefined,
    previousActions: ActionDTO[]
): boolean => {
    if (!players || !address || !currentRound) return false;
    const mine = currentRoundContribution(address, currentRound, previousActions);
    const highest = players.reduce((max, p) => {
        const c = currentRoundContribution(p.address, currentRound, previousActions);
        return c > max ? c : max;
    }, BigInt(0));
    return mine >= highest;
};
