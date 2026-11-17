/**
 * Reading the chain's flat network fee per Sit & Go seat / tournament entry
 * (block52/pokerchain#476). The fee is the x/poker param `network_fee_per_entry`
 * in micro-USDC, set by governance (0.10 USDC by default, 0 allowed). The SDK
 * (>= 1.27.0) reads it with `CosmosClient.getNetworkFeePerEntry()`.
 *
 * Whenever the live value cannot be read (no client, an SDK without the method,
 * or a failed query) the reader returns DEFAULT_NETWORK_FEE_MICRO and says so
 * (`source: "fallback"`) and logs it, so a fallback is never silent.
 */

import { DEFAULT_NETWORK_FEE_MICRO } from "./buyInUtils";
import { isNullish } from "./guards";

/** What the reader needs from a CosmosClient. The method is optional so an older SDK still works. */
export interface NetworkFeeClient {
    getNetworkFeePerEntry?: () => Promise<bigint>;
}

/** Where a network fee value came from. */
export type NetworkFeeSource = "chain" | "fallback";

export interface NetworkFeeReading {
    /** The fee per entry in micro-USDC. */
    feeMicro: bigint;
    /** "chain" = read from chain params; "fallback" = DEFAULT_NETWORK_FEE_MICRO because the read failed. */
    source: NetworkFeeSource;
}

/** How long a fee read from the chain is reused before it is read again (governance can change it). */
export const NETWORK_FEE_CACHE_MS = 5 * 60 * 1000;

const fallback = (): NetworkFeeReading => ({ feeMicro: DEFAULT_NETWORK_FEE_MICRO, source: "fallback" });

/**
 * Read the network fee from the chain through the SDK client, falling back to
 * DEFAULT_NETWORK_FEE_MICRO (and logging why) when that is not possible. Never throws.
 */
export async function readNetworkFeePerEntry(client: NetworkFeeClient | null | undefined): Promise<NetworkFeeReading> {
    if (isNullish(client)) {
        console.warn("Network fee: no Cosmos client, using the 0.10 USDC default");
        return fallback();
    }
    if (typeof client.getNetworkFeePerEntry !== "function") {
        console.warn("Network fee: this SDK has no getNetworkFeePerEntry (needs @block52/poker-vm-sdk >= 1.27.0), using the 0.10 USDC default");
        return fallback();
    }
    try {
        const feeMicro = await client.getNetworkFeePerEntry();
        if (typeof feeMicro !== "bigint" || feeMicro < 0n) {
            console.error("Network fee: chain returned an invalid value, using the 0.10 USDC default:", feeMicro);
            return fallback();
        }
        return { feeMicro, source: "chain" };
    } catch (err) {
        console.error("Network fee: could not read network_fee_per_entry from chain params, using the 0.10 USDC default:", err);
        return fallback();
    }
}

interface CacheEntry {
    reading: Promise<NetworkFeeReading>;
    readAtMs: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * The network fee for one chain endpoint (`key`, e.g. its REST URL), shared by
 * every caller: one in-flight read at a time, a chain value reused for
 * NETWORK_FEE_CACHE_MS. A fallback is not kept, so the next caller tries again.
 */
export function getNetworkFeePerEntryCached(
    key: string,
    getClient: () => NetworkFeeClient | null | undefined,
    nowMs: number = Date.now()
): Promise<NetworkFeeReading> {
    const hit = cache.get(key);
    if (!isNullish(hit) && nowMs - hit.readAtMs < NETWORK_FEE_CACHE_MS) return hit.reading;

    let client: NetworkFeeClient | null | undefined;
    try {
        client = getClient();
    } catch (err) {
        console.error("Network fee: could not create a Cosmos client, using the 0.10 USDC default:", err);
        client = null;
    }
    const reading = readNetworkFeePerEntry(client).then(result => {
        if (result.source === "fallback" && cache.get(key)?.reading === reading) cache.delete(key);
        return result;
    });
    cache.set(key, { reading, readAtMs: nowMs });
    return reading;
}

/** Forget every cached fee (tests, and a network switch that should re-read at once). */
export function clearNetworkFeeCache(): void {
    cache.clear();
}
