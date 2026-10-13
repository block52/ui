import { PlayerActionType, ActionDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { parseMicroToBigInt } from "../constants/currency";

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

/** A pot fraction as an exact ratio, so pot sizing never goes through a float. */
export type PotFraction = { numerator: bigint; denominator: bigint };

const NAMED_FRACTIONS: Record<Exclude<PotBetVariation, number>, PotFraction> = {
    "1/4": { numerator: 1n, denominator: 4n },
    "1/3": { numerator: 1n, denominator: 3n },
    "1/2": { numerator: 1n, denominator: 2n },
    "2/3": { numerator: 2n, denominator: 3n },
    "3/4": { numerator: 3n, denominator: 4n },
    "1": { numerator: 1n, denominator: 1n }
};

/**
 * Converts a pot bet variation to an exact fraction.
 *
 * Named presets map to their exact ratio (1/3 stays 1/3). A custom numeric
 * multiplier is read from its decimal digits (1.5 → 15/10), so no float
 * multiply or precision constant is involved.
 *
 * @throws If a custom multiplier is negative, not finite, or in exponent form.
 */
export function toPotFraction(variation: PotBetVariation): PotFraction {
    if (typeof variation !== "number") {
        return NAMED_FRACTIONS[variation];
    }
    const digits = String(variation);
    if (!/^\d+(\.\d+)?$/.test(digits)) {
        throw new Error(`toPotFraction: unsupported pot multiplier ${digits}`);
    }
    const [whole, decimals = ""] = digits.split(".");
    return {
        numerator: BigInt(whole + decimals),
        denominator: 10n ** BigInt(decimals.length)
    };
}

/**
 * Calculates a pot bet amount with optional variation multiplier.
 *
 * Correct poker pot bet formula:
 * - When facing a bet (callAmount > 0): CALL + fraction × (CALL + POT)
 * - When first to act (callAmount = 0): fraction × POT
 *
 * For full pot (fraction = 1): CALL + (CALL + POT) = 2×CALL + POT
 *
 * All amounts are in micro-units (10^6 precision).
 *
 * @param params Standard pot bet calculation parameters
 * @param variation Pot size variation (default: '1' for full pot)
 * @returns The calculated pot bet amount with variation applied
 */
export function calculatePotBetWithVariation(
    params: CalculatePotBetAmountParams,
    variation: PotBetVariation = "1"
): bigint {
    const { callAmount, pot } = params;

    const { numerator, denominator } = toPotFraction(variation);

    if (callAmount === 0n) {
        // First to act — a fraction of the pot
        return (pot * numerator) / denominator;
    }

    // Facing a bet: CALL + fraction × (CALL + POT)
    // The "potential pot" is what the pot would be after we call
    const potentialPot = callAmount + pot;
    const fractionAmount = (potentialPot * numerator) / denominator;
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
