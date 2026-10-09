import { FC, FormEvent, ReactNode } from "react";
import styles from "./ExplorerPanel.module.css";

/**
 * Shared building blocks for explorer pages (ui#728), so search, results,
 * loading and empty states look and behave the same on every page.
 */

/** A results card: an optional header line (title left, action right), then the body. */
export const ExplorerPanel: FC<{ header?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }> = ({
    header,
    action,
    children,
    className = ""
}) => (
    <div className={`backdrop-blur-md rounded-xl overflow-hidden ${styles.panel} ${className}`}>
        {(header || action) && (
            <div className={`flex items-center justify-between gap-3 px-3 sm:px-4 min-h-[40px] ${styles.panelHeader}`}>
                <div className="min-w-0 text-sm text-gray-400">{header}</div>
                {action}
            </div>
        )}
        {children}
    </div>
);

/** The one empty-state message style. */
export const ExplorerEmpty: FC<{ children: ReactNode }> = ({ children }) => <p className="py-8 px-4 text-center text-sm text-gray-400">{children}</p>;

/** The one loading style. */
export const ExplorerLoading: FC<{ label: string }> = ({ label }) => (
    <div className="py-8 text-center">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3 ${styles.spinner}`} />
        <p className="text-gray-400 text-sm">{label}</p>
    </div>
);

const SearchIcon = () => (
    <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
);

interface ExplorerSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** With onSubmit, a small "Search" button is shown (for searches that open a page). Without it the input filters live. */
    onSubmit?: () => void;
    busy?: boolean;
}

/** The one search input: magnifier icon, compact height; an optional small submit button. */
export const ExplorerSearchInput: FC<ExplorerSearchInputProps> = ({ value, onChange, placeholder, onSubmit, busy = false }) => {
    const submit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit?.();
    };
    return (
        <form onSubmit={submit} className="flex gap-2 mb-4" role="search">
            <div className="relative flex-1 min-w-0">
                <SearchIcon />
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${styles.searchInput}`}
                />
            </div>
            {onSubmit && (
                <button
                    type="submit"
                    disabled={busy}
                    className={`px-4 py-2 rounded-lg text-sm text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${styles.searchButton}`}
                >
                    {busy ? "Searching…" : "Search"}
                </button>
            )}
        </form>
    );
};

/** The one error style (inside a panel, like the empty and loading states). */
export const ExplorerError: FC<{ children: ReactNode }> = ({ children }) => <p className="py-6 px-4 text-center text-sm text-red-400">{children}</p>;

/** A small icon button for a panel header action, e.g. reloading a list. */
export const ExplorerReloadButton: FC<{ onClick: () => void; busy?: boolean; label?: string }> = ({ onClick, busy = false, label = "Reload list" }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={label}
        aria-label={label}
        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
    >
        <svg className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
        </svg>
    </button>
);
