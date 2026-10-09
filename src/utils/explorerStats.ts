/**
 * Pure helpers behind the explorer's block list: per-address colours and the
 * summary numbers computed from the blocks actually loaded.
 */

/** Distinct, dark-theme friendly colours for proposer markers. */
export const ADDRESS_COLORS: ReadonlyArray<string> = ["#a78bfa", "#60a5fa", "#eab308", "#34d399", "#f472b6", "#fb923c", "#22d3ee", "#f87171"];

/**
 * A stable colour for an address (FNV-1a hash into ADDRESS_COLORS), so the same
 * proposer gets the same square on every row and every visit.
 */
export const addressColor = (address: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < address.length; i++) {
        hash ^= address.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ADDRESS_COLORS[hash % ADDRESS_COLORS.length];
};

/**
 * Mean seconds between consecutive blocks, from their header times (any order).
 * Returns null when fewer than two valid times exist — there is no interval to show.
 */
export const averageBlockTimeSeconds = (times: ReadonlyArray<string>): number | null => {
    const millis = times.map(t => Date.parse(t)).filter(ms => !Number.isNaN(ms));
    if (millis.length < 2) return null;
    const newest = Math.max(...millis);
    const oldest = Math.min(...millis);
    return (newest - oldest) / 1000 / (millis.length - 1);
};

/** Number of distinct non-empty values, e.g. proposer addresses. */
export const countDistinct = (values: ReadonlyArray<string>): number => new Set(values.filter(v => v !== "")).size;
