import { ActionDTO, BettingLimit, GameVariant, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { currentRoundContribution } from "./chipUtils";
import type { PotFraction } from "./calculatePotBetAmount";

/**
 * Pre-flop bet presets (ui#751). The big-blind multiples apply to the **opening
 * raise only** — pre-flop with nobody yet raised beyond the big blind. There the
 * current bet IS the big blind, so the presets are 2x / 2.5x / 3x / 5x the big
 * blind (that's how players size an open — in blinds, not pot fractions).
 *
 * The moment anyone has bet or raised — a 3-bet pre-flop, or any flop/turn/river
 * action — the bar reverts to the pot-fraction presets (1/4 · 1/2 · 3/4 · Pot),
 * which the component handles; the multiples are an opening-raise tool only.
 *
 * Each preset is a RAISE TO total. The bar works in chips ADDED by this player,
 * so the chips they already have in this street (e.g. a posted blind) are
 * subtracted. Amounts are micro-units (cash) or chips (tournaments).
 */
export type PreflopPreset = { label: string; multiple: PotFraction };

export const UNOPENED_PREFLOP_PRESETS: readonly PreflopPreset[] = [
    { label: "2x", multiple: { numerator: 2n, denominator: 1n } },
    { label: "2.5x", multiple: { numerator: 5n, denominator: 2n } },
    { label: "3x", multiple: { numerator: 3n, denominator: 1n } },
    { label: "5x", multiple: { numerator: 5n, denominator: 1n } }
];

const isPreflopAction = (action: ActionDTO): boolean => action.round === TexasHoldemRound.ANTE || action.round === TexasHoldemRound.PREFLOP;

/** The largest total any player has committed this pre-flop street (the bet to match). */
export function highestPreflopContribution(actions: ActionDTO[]): bigint {
    const players = new Set(actions.filter(isPreflopAction).map(action => action.playerId));
    let highest = 0n;
    for (const player of players) {
        const contribution = currentRoundContribution(player, TexasHoldemRound.PREFLOP, actions);
        if (contribution > highest) highest = contribution;
    }
    return highest;
}

/** The big blind posted this hand, or 0n if none has been posted. */
export function postedBigBlind(actions: ActionDTO[]): bigint {
    const bigBlind = actions.find(action => isPreflopAction(action) && action.action === PlayerActionType.BIG_BLIND);
    return bigBlind?.amount ? BigInt(bigBlind.amount) : 0n;
}

/** Whether anyone has raised beyond the big blind pre-flop. */
export function isPreflopRaised(actions: ActionDTO[]): boolean {
    return highestPreflopContribution(actions) > postedBigBlind(actions);
}

/**
 * Whether the big-blind-multiple presets apply: only pre-flop, and only while the
 * pot is unopened (nobody has raised past the big blind). Once there's a raise, the
 * component shows pot-fraction presets instead.
 */
export function showPreflopMultiples(currentRound: TexasHoldemRound, actions: ActionDTO[]): boolean {
    return currentRound === TexasHoldemRound.PREFLOP && !isPreflopRaised(actions);
}

/**
 * Chips this player adds for a preset: the RAISE TO total (multiple × the bet
 * to match) minus what they already have in (the bet to match minus their call).
 */
export function preflopPresetAmount(highestContribution: bigint, callAmount: bigint, multiple: PotFraction): bigint {
    const raiseTo = (highestContribution * multiple.numerator) / multiple.denominator;
    const alreadyIn = highestContribution - callAmount;
    return raiseTo - alreadyIn;
}

/**
 * Whether a table opens with big-blind multiples at all. Omaha, and any
 * pot-limit table, sizes every bet against the pot — including the open — so
 * its bar is always 1/4 · 1/2 · 3/4 · Pot. Only no-limit Hold'em opens in blinds.
 *
 * @param variant The table's variant (GameStateResponseDTO.variant)
 * @param bettingLimit The table's betting limit (gameOptions.bettingLimit; absent = no-limit)
 */
export function allowsBlindMultiples(variant: GameVariant | undefined, bettingLimit: BettingLimit | string | undefined): boolean {
    return variant !== GameVariant.OMAHA && bettingLimit !== BettingLimit.POT_LIMIT;
}
