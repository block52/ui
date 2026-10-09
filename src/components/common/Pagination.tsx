import React from "react";
import { paginationWindow } from "../../utils/paginationWindow";

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    /** Plural noun for the range label, e.g. "tables" → "Showing 1–15 of 24 tables". */
    itemLabel?: string;
}

const arrowClass =
    "w-9 h-9 grid place-items-center rounded-full border border-line text-ink-body hover:bg-surface-hover disabled:text-ink-muted/50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors";

const Chevron: React.FC<{ direction: "left" | "right" }> = ({ direction }) => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
);

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalItems, pageSize, onPageChange, itemLabel }) => {
    const totalPages = Math.ceil(totalItems / pageSize);

    if (totalPages <= 1) return null;

    const first = Math.min((currentPage - 1) * pageSize + 1, totalItems);
    const last = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-line">
            <span className="text-sm text-ink-muted tabular-nums">
                Showing <span className="text-ink-body">{first}–{last}</span> of {totalItems}
                {itemLabel ? ` ${itemLabel}` : ""}
            </span>
            <nav aria-label="Pages" className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className={arrowClass}
                >
                    <Chevron direction="left" />
                </button>
                {paginationWindow(currentPage, totalPages).map((token, i) =>
                    token === "gap" ? (
                        <span key={`gap-${i}`} className="w-6 text-center text-ink-muted" aria-hidden="true">
                            …
                        </span>
                    ) : (
                        <button
                            key={token}
                            type="button"
                            onClick={() => onPageChange(token)}
                            aria-current={token === currentPage ? "page" : undefined}
                            className={`min-w-9 h-9 px-2.5 rounded-full text-sm font-semibold tabular-nums transition-colors ${
                                token === currentPage ? "bg-brand text-white" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
                            }`}
                        >
                            {token}
                        </button>
                    )
                )}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className={arrowClass}
                >
                    <Chevron direction="right" />
                </button>
            </nav>
        </div>
    );
};
