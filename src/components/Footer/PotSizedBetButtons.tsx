import React from "react";
import { calculatePotBetWithVariation, PotBetVariation } from "../../utils/calculatePotBetAmount";
import { microBigIntToUsdc } from "../../constants/currency";
import type { PotSizedBetButtonsProps } from "./types";

// One cent in micro-USDC: cash presets are rounded to the nearest cent.
const CENT_MICRO = 10_000n;

/** Round a micro-USDC amount to the nearest cent, halves up. */
const roundToCentMicro = (micro: bigint): bigint => ((micro + CENT_MICRO / 2n) / CENT_MICRO) * CENT_MICRO;

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
    onAllIn
}) => {
    const potBetOptions: { label: string; variation: PotBetVariation }[] = [
        { label: "1/4 Pot", variation: "1/4" },
        { label: "1/2 Pot", variation: "1/2" },
        { label: "3/4 Pot", variation: "3/4" },
        { label: "Pot", variation: "1" }
    ];

    // The preset's true size: the pot fraction, rounded to the cent (cash) or a
    // whole chip (tournaments). Never lifted to the minimum — a preset that comes
    // out below the legal minimum is disabled instead (see below).
    const presetAmount = (variation: PotBetVariation): number => {
        const potBetMicro: bigint = calculatePotBetWithVariation(
            {
                currentRound,
                previousActions,
                callAmount: callAmountMicro,
                pot: totalPotMicro
            },
            variation
        );
        // Tournaments deal in raw whole chips; cash converts micro-USDC (÷10^6) to dollars.
        return isTournament ? Number(potBetMicro) : microBigIntToUsdc(roundToCentMicro(potBetMicro));
    };

    // A short stack that can't afford the legal minimum can only shove, via ALL-IN.
    const cannotAffordMin = minAmount > maxAmount;

    return (
        <div className="flex justify-between gap-1 lg:gap-2 mb-1">
            {potBetOptions.map(({ label, variation }) => {
                const amount = presetAmount(variation);
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
            >
                ALL-IN
            </button>
        </div>
    );
};
