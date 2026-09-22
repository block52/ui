import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { microToUsdc } from "../constants/currency";
import { isEmpty } from "./guards";

/**
 * Calculate the total amount to display on the raise button.
 * This shows the TOTAL amount the player will have committed (not just the additional raise).
 *
 * @param playerSumOfBets - The player's current bet amount in the round (6 decimal micro-USDC format as string)
 * @param raiseAmount - The additional raise amount (in USDC as number)
 * @returns The total amount to display (current bet + raise amount)
 *
 * @example
 * // Player has bet $0.02, wants to raise by $0.02
 * calculateRaiseToDisplay("20000", 0.02) // Returns 0.04
 */
export const calculateRaiseToDisplay = (playerSumOfBets: string, raiseAmount: number): number => {
    // Game state uses 6 decimal micro-USDC format
    const currentBet = playerSumOfBets ? microToUsdc(playerSumOfBets) : 0;
    return currentBet + raiseAmount;
};

export const getRaiseToAmount = (
    raiseAmount: number,
    actions: ActionDTO[],
    currentRound: TexasHoldemRound,
    userAddress: string,
    isTournament: boolean
): number => {
    // If no actions, return raiseAmount
    if (isEmpty(actions)) {
        return raiseAmount;
    }

    // Get players previous actions
    const previousActions = actions.filter(action => action.playerId?.toLowerCase() === userAddress.toLowerCase());

    if (isEmpty(previousActions)) {
        // If no previous actions, return raiseAmount
        return raiseAmount;
    }

    const currentRoundActions: ActionDTO[] = previousActions.filter(action => action.round === currentRound);

    // If the current round is PREFLOP, include ante actions
    if (currentRound === TexasHoldemRound.PREFLOP) {
        const anteAction = previousActions.find(action => action.action === PlayerActionType.SMALL_BLIND || action.action === PlayerActionType.BIG_BLIND);
        if (anteAction) {
            // Add ante action to the current round actions
            currentRoundActions.push(anteAction);
        }
    }

    // Filter by bet and raise actions only
    const previousBetsAndRaises: ActionDTO[] = currentRoundActions.filter(
        action =>
            action.action === PlayerActionType.BET ||
            action.action === PlayerActionType.RAISE ||
            action.action === PlayerActionType.CALL ||
            action.action === PlayerActionType.SMALL_BLIND ||
            action.action === PlayerActionType.BIG_BLIND
    );

    // Sum the raise amount and previous bets/raises
    // Tournaments carry raw whole chips on the wire; cash carries micro-USDC (÷10^6).
    const totalPreviousBetsAndRaises: number = previousBetsAndRaises.reduce((sum, action) => {
        const amount = action.amount ? (isTournament ? Number(action.amount) : microToUsdc(action.amount)) : 0;
        return sum + amount;
    }, 0);

    // Calculate the raise amount based on previous bets/raises
    // return raiseAmount > 0 ? raiseAmount + totalPreviousBetsAndRaises : minRaise;

    return raiseAmount + totalPreviousBetsAndRaises;
};

/**
 * Total committed to the current street by the actor of `action`, AFTER that
 * action — what a seat badge should display (ui#638).
 *
 * The chain records each action's `amount` as the chips that LEFT THE STACK on
 * that action (the stack delta), so a raise-to-600 from the small blind (100
 * already posted) is recorded as 500 — not a poker convention. Summing the
 * actor's committing actions up to and including `action` (blind-aware via
 * {@link getRaiseToAmount}, which folds the actor's blind post into preflop
 * totals) recovers the raise-to / called-to total that the action buttons and
 * the chips in front of the seat already use.
 *
 * The `index <= action.index` cut matters in coalesced multi-action frames:
 * later actions by the same player must not leak into an earlier action's total.
 *
 * @returns display units — whole chips for tournaments, dollars for cash.
 */
export const getStreetCommitTotalForAction = (actions: ActionDTO[], action: ActionDTO, isTournament: boolean): number => {
    const upToAction = actions.filter(a => a.index <= action.index);
    return getRaiseToAmount(0, upToAction, action.round, action.playerId, isTournament);
};