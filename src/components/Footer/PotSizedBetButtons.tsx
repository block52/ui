import React from "react";
import { calculatePotBetWithVariation, PotBetVariation } from "../../utils/calculatePotBetAmount";
import { microBigIntToUsdc } from "../../constants/currency";
import type { PotSizedBetButtonsProps } from "./types";

export const PotSizedBetButtons: React.FC<PotSizedBetButtonsProps> = ({
    totalPotMicro,
    callAmountMicro,
    bigBlindMicro,
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
        { label: "3/4 Pot", variation: "3/4" }
    ];

    const calculatePotBet = (variation: PotBetVariation) => {
        // The util floors an OPENING bet at the big blind (#692). The min/max
        // clamp below still applies the game-provided legal minimum (which for a
        // RAISE TO can be higher than the BB) and caps at the available stack.
        const potBetMicro: bigint = calculatePotBetWithVariation(
            {
                currentRound,
                previousActions,
                callAmount: callAmountMicro,
                pot: totalPotMicro
            },
            variation,
            { bigBlind: bigBlindMicro }
        );
        // Tournaments deal in raw whole chips; cash converts micro-USDC (÷10^6) to dollars.
        const amount = isTournament ? Number(potBetMicro) : microBigIntToUsdc(potBetMicro);
        // Clamp the amount between the legal min and the max (stack).
        return Math.min(Math.max(amount, minAmount), maxAmount);
    };

    // The clamp above guarantees the returned amount is >= minAmount whenever the
    // stack can cover it. It can only fall short when the legal minimum itself
    // exceeds the available stack (max) — a short stack that can't afford the min
    // legal bet/raise. In that case the preset is disabled and the player shoves
    // via ALL-IN instead (never select more than the stack, #692).
    const cannotAffordMin = minAmount > maxAmount;

    return (
        <div className="flex justify-between gap-1 lg:gap-2 mb-1">
            {potBetOptions.map(({ label, variation }) => {
                const amount = calculatePotBet(variation);
                return (
                    <button
                        key={label}
                        className="btn-pot px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 transform hover:scale-105"
                        onClick={() => onAmountSelect(amount)}
                        disabled={disabled || cannotAffordMin}
                    >
                        {label}
                    </button>
                );
            })}

            <button
                className="btn-pot px-1 lg:px-2 py-1 lg:py-1.5 rounded-lg w-full border shadow-md text-[10px] lg:text-xs transition-all duration-200 transform hover:scale-105"
                onClick={() => onAmountSelect(calculatePotBet("1"))}
                disabled={disabled || cannotAffordMin}
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
