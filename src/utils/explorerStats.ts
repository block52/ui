const ADDRESS_COLORS: ReadonlyArray<string> = ["#a78bfa", "#60a5fa", "#eab308", "#34d399", "#f472b6", "#fb923c", "#22d3ee", "#f87171"];

/** FNV-1a hash into ADDRESS_COLORS, so a proposer keeps the same colour on every row and visit. */
export const addressColor = (address: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < address.length; i++) {
        hash ^= address.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ADDRESS_COLORS[hash % ADDRESS_COLORS.length];
};

/** Mean seconds between consecutive blocks from their header times (any order); null with fewer than two valid times. */
export const averageBlockTimeSeconds = (times: ReadonlyArray<string>): number | null => {
    const millis = times.map(t => Date.parse(t)).filter(ms => !Number.isNaN(ms));
    if (millis.length < 2) return null;
    let newest = -Infinity;
    let oldest = Infinity;
    for (const ms of millis) {
        if (ms > newest) newest = ms;
        if (ms < oldest) oldest = ms;
    }
    return (newest - oldest) / 1000 / (millis.length - 1);
};

export const countDistinct = (values: ReadonlyArray<string>): number => new Set(values.filter(v => v !== "")).size;
