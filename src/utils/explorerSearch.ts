/**
 * Classifies what a person typed into the explorer search box and maps it to the
 * explorer page that shows it. Pure, so the routing rule is unit-tested.
 *
 * - all digits            → block height  → /explorer/block/:height
 * - starts with "b52"     → account       → /explorer/address/:address
 * - anything else         → tx hash       → /explorer/tx/:hash
 */

export type ExplorerQuery =
    | { kind: "empty" }
    | { kind: "block"; height: string }
    | { kind: "address"; address: string }
    | { kind: "tx"; hash: string };

const BLOCK_HEIGHT = /^\d+$/;
const ADDRESS_PREFIX = "b52";

/** @example classifyExplorerQuery(" 1234 ") // { kind: "block", height: "1234" } */
export const classifyExplorerQuery = (raw: string): ExplorerQuery => {
    const query = raw.trim();
    if (query === "") return { kind: "empty" };
    if (BLOCK_HEIGHT.test(query)) {
        // Drop leading zeros so "007" opens block 7; a lone "0" stays "0".
        return { kind: "block", height: query.replace(/^0+(?=\d)/, "") };
    }
    if (query.toLowerCase().startsWith(ADDRESS_PREFIX)) return { kind: "address", address: query.toLowerCase() };
    return { kind: "tx", hash: query };
};

/** The route for a search, or null when there is nothing to search for. */
export const explorerSearchPath = (raw: string): string | null => {
    const query = classifyExplorerQuery(raw);
    switch (query.kind) {
        case "empty":
            return null;
        case "block":
            return `/explorer/block/${query.height}`;
        case "address":
            return `/explorer/address/${query.address}`;
        case "tx":
            return `/explorer/tx/${query.hash}`;
    }
};
