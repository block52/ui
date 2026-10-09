/**
 * Account activity helpers for the explorer accounts table.
 *
 * Cosmos auth accounts carry no creation time, so an account's "last active"
 * time is the timestamp of its most recent sent or received transaction.
 */

import { isNullish } from "./guards";

/**
 * The most recent of the given ISO timestamps, or null when none is usable.
 * @example
 * latestTimestamp(["2026-10-01T00:00:00Z", undefined, "2026-10-08T00:00:00Z"]) // "2026-10-08T00:00:00Z"
 */
export const latestTimestamp = (timestamps: Array<string | undefined>): string | null => {
    let latest: string | null = null;
    let latestMs = -Infinity;
    for (const timestamp of timestamps) {
        if (!timestamp) continue;
        const ms = Date.parse(timestamp);
        if (Number.isNaN(ms) || ms <= latestMs) continue;
        latest = timestamp;
        latestMs = ms;
    }
    return latest;
};

/**
 * Sort comparator for last-active timestamps. Accounts with no activity (null)
 * always sort last, whichever direction is chosen.
 */
export const compareLastActive = (a: string | null, b: string | null, order: "asc" | "desc"): number => {
    if (isNullish(a) && isNullish(b)) return 0;
    if (isNullish(a)) return 1;
    if (isNullish(b)) return -1;
    const diff = Date.parse(a) - Date.parse(b);
    return order === "desc" ? -diff : diff;
};
