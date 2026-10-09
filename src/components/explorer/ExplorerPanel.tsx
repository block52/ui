import { FC, FormEvent, ReactNode } from "react";
import { Card, pillClass } from "../ui";
import { ExplorerHeader } from "./ExplorerHeader";

/**
 * Shared building blocks for explorer pages (ui#728), so search, results,
 * loading and empty states look and behave the same on every page.
 */

/** Page shell for explorer pages: flat page surface, centred column, explorer header. */
export const ExplorerPage: FC<{ title?: string; subtitle?: string; children: ReactNode }> = ({ title, subtitle, children }) => (
    <div className="min-h-screen bg-surface-page text-ink-body">
        <div className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8">
            <ExplorerHeader title={title} subtitle={subtitle} />
            {children}
        </div>
    </div>
);

/** Uppercase column header cell style used by every explorer table. */
export const explorerThClass = "px-4 sm:px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted whitespace-nowrap";

/** Body row style: hairline divider and hover surface. */
export const explorerRowClass = "border-t border-line hover:bg-surface-hover transition-colors";

/** A results card: an optional header line (title left, action right), then the body. */
export const ExplorerPanel: FC<{ header?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }> = ({
    header,
    action,
    children,
    className = ""
}) => (
    <Card as="div" className={className}>
        {(header || action) && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 sm:px-5 py-1 min-h-[52px] border-b border-line">
                <div className="min-w-0 text-[15px] font-semibold text-ink">{header}</div>
                {action}
            </div>
        )}
        {children}
    </Card>
);

/** The one empty-state message style. */
export const ExplorerEmpty: FC<{ children: ReactNode }> = ({ children }) => <p className="py-10 px-4 text-center text-sm text-ink-muted">{children}</p>;

/** The one loading style. */
export const ExplorerLoading: FC<{ label: string }> = ({ label }) => (
    <div className="py-10 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-3" />
        <p className="text-ink-muted text-sm">{label}</p>
    </div>
);

const SearchIcon = () => (
    <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
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

/** The one search input: magnifier icon, pill shape; an optional submit pill. */
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
                    className="w-full h-11 pl-10 pr-4 rounded-btn bg-surface-card border border-line text-sm text-ink-body placeholder:text-ink-muted outline-none focus:border-brand transition-colors"
                />
            </div>
            {onSubmit && (
                <button type="submit" disabled={busy} className={pillClass("primary", "md")}>
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
        className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
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
