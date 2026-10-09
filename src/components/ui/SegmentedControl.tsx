import React, { useRef } from "react";
import { focusRing } from "./focusRing";

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

const STEP_BY_KEY: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Single-choice switcher (radio group): arrow keys move and select, only the selected segment is in the tab order. */
export const SegmentedControl = <T extends string>({ options, value, onChange, ariaLabel, fullWidth = false }: SegmentedControlProps<T>) => {
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const select = (index: number) => {
        onChange(options[index].value);
        buttonRefs.current[index]?.focus();
    };

    const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
        const step = STEP_BY_KEY[event.key];
        if (step !== undefined) {
            event.preventDefault();
            select((index + step + options.length) % options.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            select(0);
        } else if (event.key === "End") {
            event.preventDefault();
            select(options.length - 1);
        }
    };

    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={`${fullWidth ? "grid" : "inline-flex"} gap-0.5 p-1 border border-line rounded-xl bg-surface-card`}
            style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
        >
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        ref={node => {
                            buttonRefs.current[index] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={event => handleKeyDown(event, index)}
                        className={`flex items-center justify-center gap-2 h-11 sm:h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${focusRing} ${
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
};
