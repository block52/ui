import { PlayerActionType, ActionDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { parseMicroToBigInt } from "../constants/currency";
import { hasValue } from "./guards";

type CalculatePotBetAmountParams = {
    currentRound: TexasHoldemRound;
    previousActions: ActionDTO[];
    callAmount: bigint; // in micro-units (10^6)
    pot: bigint; // in micro-units (10^6)
}

export type PotBetVariation =
  | "1/4"  // Quarter pot
  | "1/3"  // Third pot
  | "1/2"  // Half pot
  | "2/3"  // Two-thirds pot
  | "3/4"  // Three-quarters pot
  | "1"    // Full pot
  | number; // Custom multiplier (e.g., 1.5 for 1.5x pot)

/**
 * Calculates the pot bet amount for ante/preflop rounds or uses fallback for other rounds.
 * All amounts are in micro-units (10^6 precision).
 *
 * @param currentRound The current round (TexasHoldemRound)
 * @param previousActions Array of previous actions (ActionDTO[])
 * @param callAmount The call amount as bigint (micro-units)
 * @param pot The current pot as bigint (micro-units)
 * @returns The calculated pot bet amount in micro-units
 */
export function calculatePotBetAmount(params: CalculatePotBetAmountParams): bigint {
    const { currentRound, previousActions, callAmount, pot } = params;

    // Find the highest bet (HB) in the round
    const roundActions = previousActions.filter(action => action.round === currentRound);

    let highestBet: bigint = 0n;
    if (Array.isArray(roundActions)) {
        for (let i = 0; i < roundActions.length; i++) {
            const action = roundActions[i];
            if ((action.action === PlayerActionType.BET || action.action === PlayerActionType.RAISE) && action.amount) {
                // Parse amount as bigint micro-units
                const amount: bigint = parseMicroToBigInt(action.amount);
                if (amount > highestBet) highestBet = amount;
            }
        }
    }

    // Pot bet calculation: CALL + HB + POT
    const potBet = callAmount + highestBet + pot;

    return potBet;
}

/**
 * Converts a pot bet variation string to a decimal multiplier
 */
function parseVariationToMultiplier(variation: string): number {
    switch (variation) {
        case "1/4": return 0.25;
        case "1/3": return 1 / 3;
        case "1/2": return 0.5;
        case "2/3": return 2 / 3;
        case "3/4": return 0.75;
        case "1": return 1.0;
        default: return 1.0;
    }
}

/** Optional constraints applied to a pot-fraction sizing. */
export type PotBetVariationOptions = {
    // The big blind in micro-units. When provided, an OPENING bet (no bet to
    // face) is floored at the big blind: a small pot can make e.g. 1/4 pot round
    // below the minimum legal open, and no-limit forbids opening under the BB
    // (#692). Not applied when facing a bet — a RAISE TO's floor is the
    // game-provided legal minimum, which the caller clamps separately.
    bigBlind?: bigint;
};

/**
 * Calculates a pot bet amount with optional variation multiplier.
 *
 * Correct poker pot bet formula:
 * - When facing a bet (callAmount > 0): CALL + fraction × (CALL + POT)
 * - When first to act (callAmount = 0): fraction × POT, floored at the big blind
 *
 * For full pot (fraction = 1): CALL + (CALL + POT) = 2×CALL + POT
 *
 * All amounts are in micro-units (10^6 precision).
 *
 * @param params Standard pot bet calculation parameters
 * @param variation Pot size variation (default: '1' for full pot)
 * @param options Optional constraints (e.g. the big-blind floor for opening bets)
 * @returns The calculated pot bet amount with variation applied
 */
export function calculatePotBetWithVariation(
    params: CalculatePotBetAmountParams,
    variation: PotBetVariation = "1",
    options: PotBetVariationOptions = {}
): bigint {
    const { callAmount, pot } = params;
    const { bigBlind } = options;

    // Convert variation to multiplier
    const multiplier = typeof variation === "number"
        ? variation
        : parseVariationToMultiplier(variation);

    // Use 10^9 precision to handle fractions like 1/3 and 2/3 accurately
    const PRECISION = 1_000_000_000n;
    const multiplierBigInt = BigInt(Math.round(multiplier * Number(PRECISION)));

    if (callAmount === 0n) {
        // First to act — a fraction of the pot, but never below the big blind:
        // a quarter of a tiny pot can round under the minimum legal open (#692).
        const fractionOfPot = (pot * multiplierBigInt) / PRECISION;
        return hasValue(bigBlind) && fractionOfPot < bigBlind ? bigBlind : fractionOfPot;
    }

    // Facing a bet: CALL + fraction × (CALL + POT)
    // The "potential pot" is what the pot would be after we call
    const potentialPot = callAmount + pot;
    const fractionAmount = (potentialPot * multiplierBigInt) / PRECISION;
    return callAmount + fractionAmount;
}

/**
 * Helper to get common pot bet variations for a given game state.
 * Useful for generating UI buttons with pre-calculated amounts.
 *
 * @param params Standard pot bet calculation parameters
 * @returns Array of objects containing label, variation, and calculated amount
 */
export function getPotBetVariations(params: CalculatePotBetAmountParams) {
    const variations: PotBetVariation[] = ["1/3", "1/2", "2/3", "1"];

    return variations.map(variation => ({
        label: variation === "1" ? "Pot" : `${variation} Pot`,
        variation,
        amount: calculatePotBetWithVariation(params, variation)
    }));
}
