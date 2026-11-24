import { usdcToMicroBigInt } from "../constants/currency";

/**
 * Whether a pot preset asks for more than the player may put in (ui#857).
 *
 * Compares the preset's TRUE size (unrounded micro-USDC for cash, whole chips
 * for tournaments) with the action's max. Comparing the unrounded amount means
 * a pot-limit Pot preset that only exceeds the cap after rounding to the cent
 * is still allowed; a preset genuinely above the stack (or the pot-limit cap)
 * is not, so it is greyed out instead of being shrunk into an all-in.
 *
 * @param presetMicro The preset amount: micro-USDC (cash) or chips (tournament)
 * @param maxAmount The legal max: dollars (cash) or chips (tournament)
 * @param isTournament Whether amounts are chips rather than USDC
 */
export function presetExceedsMax(presetMicro: bigint, maxAmount: number, isTournament: boolean): boolean {
    const max = isTournament ? BigInt(Math.floor(maxAmount)) : usdcToMicroBigInt(maxAmount);
    return presetMicro > max;
}
