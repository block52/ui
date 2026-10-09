import React from "react";
import { RaiseSlider } from "./RaiseSlider";
import { PotSizedBetButtons } from "./PotSizedBetButtons";
import type { RaiseBetControlsProps } from "./types";

export const RaiseBetControls: React.FC<RaiseBetControlsProps> = ({
    amount,
    minAmount,
    maxAmount,
    formattedMaxAmount,
    step,
    displayOffset,
    totalPotMicro,
    callAmountMicro,
    isInvalid,
    isMobileLandscape,
    isTournament,
    currentRound,
    previousActions,
    disabled,
    onAmountChange,
    onIncrement,
    onDecrement,
    onAllIn
}) => {
    return (
        <>
            {/* Slider Row */}
            <RaiseSlider
                value={amount}
                min={minAmount}
                max={maxAmount}
                step={step}
                formattedMax={formattedMaxAmount}
                displayOffset={displayOffset}
                isInvalid={isInvalid}
                disabled={disabled}
                isMobileLandscape={isMobileLandscape}
                isTournament={isTournament}
                onChange={onAmountChange}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
            />

            {/* Pot-Sized Bet Buttons - Hide in mobile landscape to save space */}
            {!isMobileLandscape && (
                <PotSizedBetButtons
                    totalPotMicro={totalPotMicro}
                    callAmountMicro={callAmountMicro}
                    minAmount={minAmount}
                    maxAmount={maxAmount}
                    isTournament={isTournament}
                    currentRound={currentRound}
                    previousActions={previousActions}
                    disabled={disabled}
                    onAmountSelect={onAmountChange}
                    onAllIn={onAllIn}
                />
            )}
        </>
    );
};
