/**
 * The bet/raise slider's position grid (ui#890).
 *
 * The slider moves in the smallest money unit — 1¢ on cash tables, 1 chip in
 * tournaments — from the legal minimum to the legal maximum. Positions are
 * whole step indexes 0…count, so the range input never rounds: index 0 is
 * exactly the minimum and index `count` is exactly the maximum (all-in or the
 * pot-limit cap), even when the maximum is not a whole number of units above
 * the minimum (an odd stack). Amounts are display units (dollars or chips), as
 * everywhere else in the action panel.

 */

import { formatSliderInputValue } from "./numberUtils";

/** The smallest bet increment: 1¢ for cash, 1 chip for tournaments. */
export const sliderUnit = (isTournament: boolean): number => (isTournament ? 1 : 0.01);

/**
 * Snap a display amount to the unit's precision (kills float noise like 0.30000000000000004).
 * Reuses the slider input's own formatter so there's one rounding rule for slider amounts.
 */
const toUnitPrecision = (amount: number, isTournament: boolean): number => Number(formatSliderInputValue(amount, isTournament));

/** How many steps the slider has; the last one lands exactly on `max`. 0 when there is no range. */
export const sliderStepCount = (min: number, max: number, isTournament: boolean): number => {
    if (!(max > min)) return 0;
    // A tiny tolerance so float noise (e.g. 1.99 - 0.03) can't add a phantom step.
    return Math.max(1, Math.ceil((max - min) / sliderUnit(isTournament) - 1e-6));
};

/** The amount at a slider position: min + index units, and exactly max at the last step. */
export const amountAtStep = (index: number, min: number, max: number, isTournament: boolean): number => {
    const count = sliderStepCount(min, max, isTournament);
    if (index <= 0 || count === 0) return min;
    if (index >= count) return max;
    return Math.min(max, toUnitPrecision(min + index * sliderUnit(isTournament), isTournament));
};

/** The slider position for an amount, clamped to the range (amounts between steps round to the nearest). */
export const stepForAmount = (amount: number, min: number, max: number, isTournament: boolean): number => {
    const count = sliderStepCount(min, max, isTournament);
    if (count === 0 || !(amount > min)) return 0;
    if (amount >= max) return count;
    return Math.min(count - 1, Math.max(0, Math.round((amount - min) / sliderUnit(isTournament))));
};
