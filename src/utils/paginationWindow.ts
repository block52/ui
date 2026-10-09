/** A page number, or a gap rendered as "…". */
export type PageToken = number | "gap";

/**
 * Page numbers to show in a pager, collapsing long runs into gaps.
 * Always keeps the first and last page and `siblings` pages either side of
 * the current one, e.g. `1 … 4 5 6 … 12`.
 *
 * @param current 1-based current page (clamped into range).
 * @param total total page count; 0 or less yields an empty list.
 * @param siblings pages shown on each side of `current`.
 */
export const paginationWindow = (current: number, total: number, siblings = 1): PageToken[] => {
    if (total <= 0) return [];
    const page = Math.min(Math.max(current, 1), total);
    // first + last + current + siblings on both sides + two gaps
    const maxSlots = siblings * 2 + 5;
    if (total <= maxSlots) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const start = Math.max(2, page - siblings);
    const end = Math.min(total - 1, page + siblings);
    const tokens: PageToken[] = [1];
    if (start > 2) tokens.push("gap");
    for (let n = start; n <= end; n++) tokens.push(n);
    if (end < total - 1) tokens.push("gap");
    tokens.push(total);
    return tokens;
};
