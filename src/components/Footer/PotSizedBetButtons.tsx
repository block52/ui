import React from "react";
import { calculatePotBetWithVariation, PotBetVariation } from "../../utils/calculatePotBetAmount";
import { microBigIntToUsdc } from "../../constants/currency";
import type { PotSizedBetButtonsProps } from "./types";

export const PotSizedBetButtons: React.FC<PotSizedBetButtonsProps> = ({
    totalPotMicro,
    callAmountMicro,
    minAmount,
    maxAmount,
    currentRound,
    previousActions,
    disabled,
    onAmountSelect,
    onAllIn
}) => {
    const potBetOptions: { label: string; variation: PotBetVariation }[] = [
        { label: "1/4 Pot", variation: "1/4" },
        { label: "1/2 Pot", variation: "1/2" },
        { label: "3/4 Pot", variation: "3/4" }
    ];

    const calculatePotBet = (variation: PotBetVariation) => {
        const potBetMicro: bigint = calculatePotBetWithVariation(
            {
                currentRound,
                previousActions,
                callAmount: callAmountMicro,
                pot: totalPotMicro
            },
            variation
        );
        const amount = microBigIntToUsdc(potBetMicro);
        // Clamp the amount between min and max
        return Math.min(Math.max(amount, minAmount), maxAmount);
    };

    return (
        <div className="flex justify-between gap-1 lg:gap-2 mb-1">
            {potBetOptions.map(({ label, variation }) => (
                <button
                    key={label}
                    className="btn-pot px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 transform hover:scale-105"
                    onClick={() => onAmountSelect(calculatePotBet(variation))}
                    disabled={disabled}
                >
                    {label}
                </button>
            ))}

            <button
                className="btn-pot px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 transform hover:scale-105"
                onClick={() => onAmountSelect(calculatePotBet("1"))}
                disabled={disabled}
            >
                Pot
            </button>

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
