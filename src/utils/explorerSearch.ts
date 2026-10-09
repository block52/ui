/**
 * Maps what a person typed into the explorer search box to the explorer page
 * that shows it. Pure, so the routing rule is unit-tested.
 *
 * - all digits                       → block height → /explorer/block/:height
 * - 64 hex characters (opt. "0x")    → tx hash      → /explorer/tx/:hash
 * - starts with "b52"                → account      → /explorer/address/:address
 * - anything else                    → tx hash      → /explorer/tx/:hash
 *
 * The hash shape is checked before the address prefix: "b52" is valid hex, so
 * about 1 in 4096 transaction hashes start with it.
 */

type ExplorerQuery =
    | { kind: "empty" }
    | { kind: "block"; height: string }
    | { kind: "address"; address: string }
    | { kind: "tx"; hash: string };

const BLOCK_HEIGHT = /^\d+$/;
const TX_HASH = /^(?:0x)?([0-9a-f]{64})$/i;
const ADDRESS_PREFIX = "b52";

const classifyExplorerQuery = (raw: string): ExplorerQuery => {
    const query = raw.trim();
    if (query === "") return { kind: "empty" };
    if (BLOCK_HEIGHT.test(query)) {
        return { kind: "block", height: query.replace(/^0+(?=\d)/, "") };
    }
    const hash = TX_HASH.exec(query);
    if (hash) return { kind: "tx", hash: hash[1] };
    if (query.toLowerCase().startsWith(ADDRESS_PREFIX)) return { kind: "address", address: query.toLowerCase() };
    return { kind: "tx", hash: query };
};

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
