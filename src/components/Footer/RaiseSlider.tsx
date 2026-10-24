import React from "react";
import { formatDisplayAmount, formatSliderInputValue, parseSliderInput } from "../../utils/numberUtils";
import { hasValue } from "../../utils/guards";
import type { RaiseSliderProps } from "./types";
import { amountAtStep, sliderStepCount, stepForAmount } from "../../utils/raiseSlider";
import styles from "./RaiseSlider.module.css";

export const RaiseSlider: React.FC<RaiseSliderProps> = ({
    value,
    min,
    max,
    formattedMax,
    displayOffset,
    isInvalid,
    disabled,
    isMobileLandscape,
    isTournament,
    isAllIn,
    onChange,
    onIncrement,
    onDecrement
}) => {
    const displayValue = value + displayOffset;
    // The range input works in whole steps of 1¢ (1 chip in tournaments) from
    // the legal min; the last step is exactly the legal max, so all-in (or the
    // pot cap) is always reachable (ui#890).
    const stepCount = sliderStepCount(min, max, isTournament);
    const position = stepForAmount(value, min, max, isTournament);
    const percentage = stepCount > 0 ? (position / stepCount) * 100 : 0;

    // Tournaments show whole chips (no "$", no decimals); cash shows "$X.XX".
    const displayString = formatSliderInputValue(displayValue, isTournament);
    const handleInput = (raw: string) => {
        const next = parseSliderInput(raw, displayOffset, isTournament);
        if (hasValue(next)) onChange(next);
    };

    const inputFieldClassName = isInvalid
        ? "bg-gray-700/80 text-red-400 border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500/50"
        : "bg-gray-700/80 text-white border-blue-500/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30";

    return (
        <div
            className={`flex items-center bg-[#0f172a40] backdrop-blur-sm rounded-lg border border-[#3a546d]/50 shadow-inner ${
                isMobileLandscape ? "gap-1 px-1 py-0.5 h-8" : "space-x-2 lg:space-x-4 p-2 lg:p-3"
            }`}
        >
            {/* Min/Max text - placed first in mobile landscape */}
            {isMobileLandscape && (
                <div className="flex items-center text-[9px] text-gray-400 whitespace-nowrap">
                    <span>Min:{formatDisplayAmount(min, isTournament)}</span>
                    <span className="mx-1">/</span>
                    <span>Max:{formattedMax}</span>
                </div>
            )}

            {/* Decrement Button */}
            <button
                className={
                    isMobileLandscape
                        ? "btn-slider py-0.5 px-1.5 rounded border text-[10px] transition-all duration-200"
                        : "btn-slider py-1 px-2 lg:px-4 rounded-lg border text-xs lg:text-sm transition-all duration-200"
                }
                onClick={onDecrement}
                disabled={disabled}
            >
                -
            </button>

            {/* Slider with dynamic fill */}
            <input
                type="range"
                min={0}
                max={stepCount}
                step={1}
                value={position}
                onChange={(e) => onChange(amountAtStep(Number(e.target.value), min, max, isTournament))}
                aria-label="Bet amount"
                aria-valuetext={displayString}
                className={`${styles.slider} ${isMobileLandscape ? styles.compact : ""}`}
                style={
                    {
                        "--fill": `linear-gradient(to right, #64ffda 0%, #64ffda ${percentage}%, #1e293b ${percentage}%, #1e293b 100%)`
                    } as React.CSSProperties
                }
                disabled={disabled}
            />

            {/* Increment Button */}
            <button
                className={
                    isMobileLandscape
                        ? "btn-slider py-0.5 px-1.5 rounded border text-[10px] transition-all duration-200"
                        : "btn-slider py-1 px-2 lg:px-4 rounded-lg border text-xs lg:text-sm transition-all duration-200"
                }
                onClick={onIncrement}
                disabled={disabled}
            >
                +
            </button>

            {/* Inline Input Box - compact for mobile landscape */}
            {!isMobileLandscape && (
                <div className="flex items-center gap-1 min-w-0">
                    {isAllIn && <span className={styles.allInTag}>ALL-IN</span>}
                    <input
                        type="text"
                        inputMode={isTournament ? "numeric" : "decimal"}
                        value={displayString}
                        onChange={(e) => handleInput(e.target.value)}
                        className={`${inputFieldClassName} px-1 lg:px-2 py-1 rounded text-xs lg:text-sm w-[80px] lg:w-[100px] transition-all duration-200 border`}
                        disabled={disabled}
                    />
                </div>
            )}

            {isMobileLandscape && isAllIn && <span className={styles.allInTag}>ALL-IN</span>}
            {isMobileLandscape && (
                <input
                    type="text"
                    inputMode={isTournament ? "numeric" : "decimal"}
                    value={displayString}
                    onChange={(e) => handleInput(e.target.value)}
                    className={`${inputFieldClassName} px-1 py-0.5 rounded text-[10px] w-[50px] transition-all duration-200 border`}
                    disabled={disabled}
                />
            )}
        </div>
    );
};
