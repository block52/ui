import React from "react";
import { calculatePotBetWithVariation, PotBetVariation } from "../../utils/calculatePotBetAmount";
import { highestPreflopContribution, preflopPresetAmount, showPreflopMultiples, UNOPENED_PREFLOP_PRESETS } from "../../utils/preflopPresets";
import { microBigIntToUsdc, roundMicroToCent } from "../../constants/currency";
import type { PotSizedBetButtonsProps } from "./types";

const POT_FRACTION_PRESETS: { label: string; variation: PotBetVariation }[] = [
    { label: "1/4 Pot", variation: "1/4" },
    { label: "1/2 Pot", variation: "1/2" },
    { label: "3/4 Pot", variation: "3/4" }
];

export const PotSizedBetButtons: React.FC<PotSizedBetButtonsProps> = ({
    totalPotMicro,
    callAmountMicro,
    minAmount,
    maxAmount,
    isTournament,
    currentRound,
    previousActions,
    disabled,
    onAmountSelect,
    onAllIn,
    maxIsAllIn
}) => {
    const potBetMicro = (variation: PotBetVariation): bigint =>
        calculatePotBetWithVariation(
            {
                currentRound,
                previousActions,
                callAmount: callAmountMicro,
                pot: totalPotMicro
            },
            variation
        );

    // The opening raise pre-flop uses big-blind multiples (2x/2.5x/3x/5x, ui#751) —
    // four buttons, no pot. The moment there's a raise, or on any later street, the
    // bar reverts to pot fractions (1/4 · 1/2 · 3/4 · Pot).
    const useMultiples = showPreflopMultiples(currentRound, previousActions);
    const highest = useMultiples ? highestPreflopContribution(previousActions) : 0n;
    const presets: { label: string; micro: bigint }[] = useMultiples
        ? UNOPENED_PREFLOP_PRESETS.map(({ label, multiple }) => ({
              label,
              micro: preflopPresetAmount(highest, callAmountMicro, multiple)
          }))
        : [
              ...POT_FRACTION_PRESETS.map(({ label, variation }) => ({ label, micro: potBetMicro(variation) })),
              { label: "Pot", micro: potBetMicro("1") }
          ];

    // The preset's true size, rounded to the cent (cash) or a whole chip
    // (tournaments). Never lifted to the minimum — a preset that comes out below
    // the legal minimum is disabled instead (see below).
    const presetAmount = (micro: bigint): number => (isTournament ? Number(micro) : microBigIntToUsdc(roundMicroToCent(micro)));

    // A short stack that can't afford the legal minimum can only shove, via ALL-IN.
    const cannotAffordMin = minAmount > maxAmount;

    return (
        <div className="flex justify-between gap-1 lg:gap-2 mb-1">
            {presets.map(({ label, micro }) => {
                const amount = presetAmount(micro);
                // Each preset is judged on its own: one that would bet less than the
                // legal minimum (one big blind to open, the min raise when facing a
                // bet) is greyed out rather than silently resized.
                const belowMin = amount < minAmount;
                return (
                    <button
                        key={label}
                        className="btn-pot px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
                        // Above the stack, the preset selects the whole stack (all-in).
                        onClick={() => onAmountSelect(Math.min(amount, maxAmount))}
                        disabled={disabled || cannotAffordMin || belowMin}
                        title={belowMin ? "Below the minimum bet" : undefined}
                    >
                        {label}
                    </button>
                );
            })}

            <button
                className="btn-all-in px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 font-medium transform active:scale-105"
                onClick={onAllIn}
                disabled={disabled}
                title={maxIsAllIn ? undefined : "The most the pot-limit allows"}
            >
                {maxIsAllIn ? "ALL-IN" : "MAX"}
            </button>
        </div>
    );
};
