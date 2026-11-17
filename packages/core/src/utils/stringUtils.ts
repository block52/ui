/**
 * String formatting utilities.
 */

/**
 * Truncate a string to its first `startChars` and last `endChars`, joined by a
 * separator. This is the single home for the
 * `${value.slice(0, n)}...${value.slice(-m)}` middle-ellipsis pattern that was
 * previously duplicated across address/hash/id formatters and inline in JSX.
 *
 * Returns "" for null/undefined/empty input. Note: like the call sites it
 * replaces, it does NOT short-circuit when the string is shorter than
 * startChars + endChars (the slices may overlap). Callers that need that
 * behaviour (e.g. truncateHash) guard before delegating here.
 *
 * @param value - The string to truncate
 * @param startChars - Number of characters to keep at the start
 * @param endChars - Number of characters to keep at the end
 * @param separator - Joiner between the two slices (default "...")
 * @returns Truncated string like "b521rg...fj9p", or "" when value is empty
 * @example
 * truncateMiddle("b521rg9q8h7j6k5fj9p", 6, 4) // "b521rg...fj9p"
 */
export const truncateMiddle = (
    value: string | null | undefined,
    startChars: number,
    endChars: number,
    separator: string = "..."
): string => {
    if (!value) return "";
    return `${value.slice(0, startChars)}${separator}${value.slice(-endChars)}`;
};
