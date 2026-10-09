import React from "react";

export interface AmountPreset {
    /** Text on the pill, e.g. "$25" or "Max". */
    label: string;
    /** Value passed back to onPick, already formatted for the amount input. */
    value: string;
}

interface AmountPresetsProps {
    presets: ReadonlyArray<AmountPreset>;
    /** Current amount-input text; the matching pill is shown as selected. */
    current: string;
    onPick: (value: string) => void;
    disabled?: boolean;
}

/** Row of quick-amount pills under an amount field. */
export const AmountPresets: React.FC<AmountPresetsProps> = ({ presets, current, onPick, disabled = false }) => (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
        {presets.map(preset => {
            const selected = current === preset.value;
            return (
                <button
                    key={preset.label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => onPick(preset.value)}
                    className={`h-11 sm:h-9 px-4 rounded-full border text-sm font-semibold tabular-nums transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        selected ? "border-brand bg-brand/15 text-ink" : "border-line-strong text-ink-soft hover:text-ink hover:bg-surface-hover"
                    }`}
                >
                    {preset.label}
                </button>
            );
        })}
    </div>
);
