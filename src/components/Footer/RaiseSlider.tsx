import React from "react";
import { formatDisplayAmount, formatSliderInputValue, parseSliderInput } from "../../utils/numberUtils";
import { hasValue } from "../../utils/guards";
import type { RaiseSliderProps } from "./types";

export const RaiseSlider: React.FC<RaiseSliderProps> = ({
    value,
    min,
    max,
    step,
    formattedMax,
    displayOffset,
    isInvalid,
    disabled,
    isMobileLandscape,
    isTournament,
    onChange,
    onIncrement,
    onDecrement
}) => {
    const displayValue = value + displayOffset;
    const percentage = ((value - min) / (max - min)) * 100;

    // Tournaments show whole chips (no "$", no decimals); cash shows "$X.XX".
    const displayString = formatSliderInputValue(displayValue, isTournament);
    const handleInput = (raw: string) => {
        const next = parseSliderInput(raw, displayOffset, isTournament);
        if (hasValue(next)) onChange(next);
    };

    const inputFieldClassName = isInvalid
        ? "bg-surface-raised text-red-400 border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500/50"
        : "bg-surface-raised text-ink border-line-strong focus:border-brand focus:ring-1 focus:ring-brand/30";

    return (
        <div
            className={`flex items-center ${
                isMobileLandscape ? "gap-1 px-1 py-0.5 h-8 bg-surface-card/80 rounded-xl border border-line" : "gap-2 lg:gap-3 px-1 lg:min-h-11"
            }`}
        >
            {/* Min/Max text - placed first in mobile landscape */}
            {isMobileLandscape && (
                <div className="flex items-center text-[9px] text-ink-muted whitespace-nowrap">
                    <span>Min:{formatDisplayAmount(min, isTournament)}</span>
                    <span className="mx-1">/</span>
                    <span>Max:{formattedMax}</span>
                </div>
            )}

            {!isMobileLandscape && <span className="hidden lg:inline text-xs text-ink-muted whitespace-nowrap">Raise to</span>}

            {/* Decrement Button */}
            <button
                className={
                    isMobileLandscape
                        ? "btn-slider py-0.5 px-1.5 rounded border text-[10px] transition-all duration-200"
                        : "btn-slider w-8 h-8 lg:w-9 lg:h-9 grid place-items-center rounded-btn border text-sm transition-all duration-200"
                }
                onClick={onDecrement}
                disabled={disabled}
            >
                -
            </button>

            {/* Slider with dynamic fill */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className={
                    isMobileLandscape
                        ? "raise-range flex-1 transition-all duration-200"
                        : "raise-range flex-1 transition-all duration-200"
                }
                style={{
                    background: `linear-gradient(to right, var(--brand-primary) 0%, var(--brand-primary) ${percentage}%, rgb(var(--line-strong)) ${percentage}%, rgb(var(--line-strong)) 100%)`
                }}
                disabled={disabled}
            />

            {/* Increment Button */}
            <button
                className={
                    isMobileLandscape
                        ? "btn-slider py-0.5 px-1.5 rounded border text-[10px] transition-all duration-200"
                        : "btn-slider w-8 h-8 lg:w-9 lg:h-9 grid place-items-center rounded-btn border text-sm transition-all duration-200"
                }
                onClick={onIncrement}
                disabled={disabled}
            >
                +
            </button>

            {/* Inline Input Box - compact for mobile landscape */}
            {!isMobileLandscape && (
                <div className="flex flex-col items-end gap-1 min-w-0">
                    <input
                        type="text"
                        inputMode={isTournament ? "numeric" : "decimal"}
                        value={displayString}
                        onChange={(e) => handleInput(e.target.value)}
                        className={`${inputFieldClassName} px-2 lg:h-9 py-1.5 lg:py-0 rounded-lg text-sm font-semibold tabular-nums text-right w-[84px] transition-all duration-200 border`}
                        disabled={disabled}
                    />
                </div>
            )}

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
