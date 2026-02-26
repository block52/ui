import React from "react";
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
    onChange,
    onIncrement,
    onDecrement
}) => {
    const displayValue = value + displayOffset;
    const percentage = ((value - min) / (max - min)) * 100;

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
                    <span>Min:${min.toFixed(2)}</span>
                    <span className="mx-1">/</span>
                    <span>Max:${formattedMax}</span>
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
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className={
                    isMobileLandscape
                        ? "flex-1 accent-[#64ffda] h-1 rounded-full transition-all duration-200"
                        : "flex-1 accent-[#64ffda] h-2 rounded-full transition-all duration-200"
                }
                style={{
                    background: `linear-gradient(to right, #64ffda 0%, #64ffda ${percentage}%, #1e293b ${percentage}%, #1e293b 100%)`
                }}
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
                <div className="flex flex-col items-end gap-1 min-w-0">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={displayValue.toFixed(2)}
                        onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                                onChange(0);
                                return;
                            }
                            if (/^\d*\.?\d{0,2}$/.test(raw)) {
                                if (!isNaN(Number(raw)) && /^\d*\.?\d{1,2}$/.test(raw)) {
                                    onChange(Math.max(0, parseFloat(raw) - displayOffset));
                                }
                            }
                        }}
                        className={`${inputFieldClassName} px-1 lg:px-2 py-1 rounded text-xs lg:text-sm w-[80px] lg:w-[100px] transition-all duration-200 border`}
                        disabled={disabled}
                    />
                </div>
            )}

            {isMobileLandscape && (
                <input
                    type="text"
                    inputMode="decimal"
                    value={displayValue.toFixed(2)}
                    onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                            onChange(0);
                            return;
                        }
                        if (/^\d*\.?\d{0,2}$/.test(raw)) {
                            if (!isNaN(Number(raw)) && /^\d*\.?\d{1,2}$/.test(raw)) {
                                onChange(Math.max(0, parseFloat(raw) - displayOffset));
                            }
                        }
                    }}
                    className={`${inputFieldClassName} px-1 py-0.5 rounded text-[10px] w-[50px] transition-all duration-200 border`}
                    disabled={disabled}
                />
            )}
        </div>
    );
};
