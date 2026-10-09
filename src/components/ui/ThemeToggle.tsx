import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { isDarkOnlyRoute } from "../../utils/theme";
import { useLocation } from "react-router-dom";
import { focusRing } from "./focusRing";

/** Hidden on game tables, which are always dark. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
    const { preference, toggle } = useTheme();
    const { pathname } = useLocation();

    if (isDarkOnlyRoute(pathname)) return null;

    const goingLight = preference === "dark";
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={goingLight ? "Switch to light mode" : "Switch to dark mode"}
            title={goingLight ? "Light mode" : "Dark mode"}
            className={`w-11 h-11 lg:w-9 lg:h-9 grid place-items-center rounded-btn text-ink-soft hover:text-ink hover:bg-surface-hover transition-colors ${focusRing} ${className}`}
        >
            {goingLight ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
            )}
        </button>
    );
};
