import React from "react";

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
    /** Optional count shown in a small badge after the label. */
    count?: number;
}

interface SegmentedControlProps<T extends string> {
    options: ReadonlyArray<SegmentOption<T>>;
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    /** Stretch segments to fill the row (mobile). */
    fullWidth?: boolean;
}

/** Pill-group switcher, e.g. All / Cash / Sit & Go with counts. */
export const SegmentedControl = <T extends string>({ options, value, onChange, ariaLabel, fullWidth = false }: SegmentedControlProps<T>) => (
    <div
        role="tablist"
        aria-label={ariaLabel}
        className={`${fullWidth ? "grid" : "inline-flex"} gap-0.5 p-1 border border-line rounded-xl bg-surface-card`}
        style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
        {options.map(option => {
            const selected = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onChange(option.value)}
                    className={`flex items-center justify-center gap-2 h-11 sm:h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        selected ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
                    }`}
                >
                    {option.label}
                    {option.count !== undefined && (
                        <span
                            className={`min-w-5 px-1.5 rounded-md text-xs tabular-nums ${selected ? "bg-white/20 text-white" : "bg-line text-ink-soft"}`}
                        >
                            {option.count}
                        </span>
                    )}
                </button>
            );
        })}
    </div>
);
