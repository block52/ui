import React from "react";

interface PillToggleProps {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

/** Small pill used for preset groups: selected = solid brand, others outlined. */
export const PillToggle: React.FC<PillToggleProps> = ({ selected, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`h-11 sm:h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
            selected ? "bg-brand text-white border-transparent" : "border-line-strong text-ink-soft hover:bg-surface-hover hover:text-ink"
        }`}
    >
        {children}
    </button>
);
