import React from "react";
import { ChoicePill } from "../ui";

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

export const AmountPresets: React.FC<AmountPresetsProps> = ({ presets, current, onPick, disabled = false }) => (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
        {presets.map(preset => (
            <ChoicePill
                key={preset.label}
                selected={current === preset.value}
                disabled={disabled}
                onClick={() => onPick(preset.value)}
                className="font-semibold tabular-nums"
            >
                {preset.label}
            </ChoicePill>
        ))}
    </div>
);
