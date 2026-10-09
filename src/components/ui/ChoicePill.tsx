import React from "react";
import { focusRing } from "./focusRing";

interface ChoicePillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
    selected: boolean;
}

export const ChoicePill: React.FC<ChoicePillProps> = ({ selected, className = "", type = "button", ...rest }) => (
    <button
        type={type}
        aria-pressed={selected}
        className={`h-11 sm:h-9 px-4 rounded-btn border text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing} ${
            selected ? "bg-brand text-white border-transparent" : "border-line-strong text-ink-soft hover:bg-surface-hover hover:text-ink"
        } ${className}`}
        {...rest}
    />
);
