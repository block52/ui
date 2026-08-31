/**
 * Cosmos Client creation and management
 *
 * This file provides a minimal wrapper around the SDK's CosmosClient
 * with singleton pattern for the frontend.
 */

import { CosmosClient, SigningCosmosClient, createSigningClientFromMnemonic, getDefaultCosmosConfig as getDefaultCosmosConfigSDK, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { getCosmosAddress, getCosmosMnemonic } from "./storage";
import { getCosmosUrls, type NetworkEndpoints } from "./urls";

// Local type definition (not exported from SDK main index)
interface CosmosConfig {
    rpcEndpoint: string;
    restEndpoint: string;
    chainId: string;
    prefix: string;
    denom: string;
    gasPrice: string;
    mnemonic?: string;
}

// Re-export types and constants from SDK
export type { CosmosClient };
export { COSMOS_CONSTANTS };

// Re-export getCosmosUrls for REST endpoint queries
export { getCosmosUrls };

/**
 * Get default cosmos configuration with environment variable overrides
 * Uses SDK's getDefaultCosmosConfig() and overrides with env vars if present
 */
export const getDefaultCosmosConfig = (network: NetworkEndpoints): CosmosConfig => {
    const sdkConfig = getDefaultCosmosConfigSDK();
    const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);

    return {
        ...sdkConfig,
        rpcEndpoint,
        restEndpoint,
    };
};

/**
 * Get cosmos configuration with custom endpoints
 * Used when switching networks dynamically
 */
export const getCosmosConfigWithEndpoints = (rpcEndpoint: string, restEndpoint: string): CosmosConfig => {
    const sdkConfig = getDefaultCosmosConfigSDK();

    return {
        ...sdkConfig,
        rpcEndpoint,
        restEndpoint,
    };
};

/**
 * Get singleton Cosmos client instance
 * This ensures we reuse the same client across the app
 */
let clientInstance: CosmosClient | null = null;
let currentEndpoints: { rpc: string; rest: string } | null = null;

export const getCosmosClient = (
    networkOrEndpoints: NetworkEndpoints | { rpc: string; rest: string }
): CosmosClient | null => {
    // Determine if we have custom endpoints or a network config
    const customEndpoints = "rpc" in networkOrEndpoints && "rest" in networkOrEndpoints && !("name" in networkOrEndpoints)
        ? networkOrEndpoints as { rpc: string; rest: string }
        : null;

    const network = customEndpoints ? null : networkOrEndpoints as NetworkEndpoints;

    // Get the actual endpoints to use (either custom or from network config)
    const newEndpoints = customEndpoints
        ? { rpc: customEndpoints.rpc, rest: customEndpoints.rest }
        : { rpc: network!.rpc, rest: network!.rest };

    // Clear client if endpoints have changed (network switch or custom endpoint change)
    if (
        currentEndpoints &&
        (currentEndpoints.rpc !== newEndpoints.rpc || currentEndpoints.rest !== newEndpoints.rest)
    ) {
        clientInstance = null;
    }

    if (!clientInstance) {
        const mnemonic = getCosmosMnemonic();
        const config = customEndpoints
            ? getCosmosConfigWithEndpoints(customEndpoints.rpc, customEndpoints.rest)
            : getDefaultCosmosConfig(network!);

        if (!mnemonic) {
            // For read-only operations (like explorer), create client without mnemonic
            clientInstance = new CosmosClient(config);
        } else {
            clientInstance = new CosmosClient({ ...config, mnemonic });
        }

        // Track current endpoints for change detection
        currentEndpoints = newEndpoints;
    }

    return clientInstance;
};

/**
 * Clear the cached client instance (useful when changing wallets or networks).
 * Also clears the signing-client cache so the next action rebuilds against
 * fresh endpoints / wallet material.
 */
export const clearCosmosClient = (): void => {
    clientInstance = null;
    currentEndpoints = null;
    clearSigningClientCache();
};

/**
 * Promise-memoized signing client.
 *
 * createSigningClientFromMnemonic does two expensive things on every call:
 *   1. HD wallet derivation from the mnemonic — BIP39 PBKDF2 (2048 rounds)
 *      plus secp256k1 BIP32 derivation. Tens of ms on the main thread.
 *   2. connectWithSigner opens a Tendermint RPC connection and does a
 *      status handshake — a network round-trip.
 *
 * Neither needs to be redone per bet/call/raise — the result is identical
 * for the whole session. We cache the *promise* (not the resolved value)
 * so concurrent callers (e.g. a rapid bet→raise misclick) share a single
 * in-flight construction instead of building two clients in parallel.
 *
 * The cache key is `address|rpcEndpoint|restEndpoint` so it invalidates
 * naturally on wallet swap or network switch.
 */
type SigningClientResult = { signingClient: SigningCosmosClient; userAddress: string };

let signingClientCache: {
    key: string;
    promise: Promise<SigningClientResult>;
} | null = null;

/**
 * Get (or build and cache) the signing client for the current wallet + network.
 *
 * Returns the same Promise across concurrent calls within a session, so
 * the expensive PBKDF2 derivation runs once per (wallet, network) pair.
 *
 * @throws Error if Cosmos wallet is not initialized (no mnemonic or address)
 */
export async function getSigningClient(network: NetworkEndpoints): Promise<SigningClientResult> {
    const userAddress = getCosmosAddress();
    const mnemonic = getCosmosMnemonic();

    if (!userAddress || !mnemonic) {
        throw new Error("Block52 wallet not initialized. Please create or import a Block52 wallet first.");
    }

    const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);
    const key = `${userAddress}|${rpcEndpoint}|${restEndpoint}`;

    if (signingClientCache?.key === key) {
        return signingClientCache.promise;
    }

    const promise = createSigningClientFromMnemonic(
        {
            rpcEndpoint,
            restEndpoint,
            chainId: COSMOS_CONSTANTS.CHAIN_ID,
            prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
            denom: "stake",
            gasPrice: "0stake" // Gasless
        },
        mnemonic
    ).then(signingClient => ({ signingClient, userAddress }));

    // If construction rejects, drop the cache so the next call retries
    // instead of returning a permanently-failed promise.
    promise.catch(() => {
        if (signingClientCache?.promise === promise) {
            signingClientCache = null;
        }
    });

    signingClientCache = { key, promise };
    return promise;
}

/**
 * Clear the cached signing client.
 *
 * Call on: logout, wallet import/change, network switch.
 *
 * Also call from the action layer's error handler when a broadcast fails
 * with a connection-level error (stale RPC socket, node restart, etc.) —
 * see withSigningClientRetry below for the standard retry-once wrapper.
 */
export function clearSigningClientCache(): void {
    const previous = signingClientCache;
    signingClientCache = null;
    // Best-effort cleanup — disconnect if the SDK exposes it.
    previous?.promise
        .then(c => (c.signingClient as { disconnect?: () => void }).disconnect?.())
        .catch(() => { /* already-rejected promise, nothing to disconnect */ });
}

/**
 * Run an action against the signing client. If it fails with a transport-
 * shaped error (the cached connection went stale), clear the cache and
 * retry exactly once with a fresh client.
 *
 * Use this in the action layer wherever you'd previously call
 * `const { signingClient } = await getSigningClient(network)` directly:
 *
 *   const hash = await withSigningClientRetry(network, ({ signingClient }) =>
 *       signingClient.performActionSync(tableId, action, amount)
 *   );
 *
 * CheckTx rejections (invalid signature, insufficient gas, malformed msg)
 * are application errors, not transport errors — those are NOT retried.
 */
export async function withSigningClientRetry<T>(
    network: NetworkEndpoints,
    fn: (client: SigningClientResult) => Promise<T>
): Promise<T> {
    const client = await getSigningClient(network);
    try {
        return await fn(client);
    } catch (err) {
        if (!isTransportError(err)) {
            throw err;
        }
        clearSigningClientCache();
        const fresh = await getSigningClient(network);
        return fn(fresh);
    }
}

/**
 * Does this error look like a Cosmos account-sequence mismatch (SDK code 32,
 * "account sequence mismatch, expected N, got M")?
 *
 * Every tx from an account carries an account sequence (performActionSync uses
 * standard signAndBroadcastSync). When a prior tx is still pending in the mempool
 * (accepted by CheckTx but not yet committed), a fresh `getSequence` query still
 * returns the pre-increment value, so the next tx signs a sequence that collides
 * and the chain rejects it with this error. Repeatable while the pending tx sits
 * uncommitted — which is why "no one can join" (ui#530 follow-up).
 *
 * This is NOT limited to money-movers: any gameplay / non-player action (e.g.
 * sit-out) that races a still-pending tx from the same account hits it too, which
 * is why executeTransportAction now recovers from it as well.
 */
export function isSequenceMismatchError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return /account sequence mismatch/i.test(message);
}

/**
 * Run a chain-direct MONEY-MOVER (join / leave / top-up) with recovery for the
 * two ways a cached client + ordered sequence can transiently fail:
 *
 *   - Transport error (stale RPC socket): clear the cache, reconnect, retry.
 *   - Sequence mismatch (a prior money-mover still pending in the mempool):
 *     clear the cache so the retry reconnects and re-queries the sequence, wait
 *     a beat for the pending tx to commit and bump the on-chain sequence, then
 *     retry. CosmJS re-queries `getSequence` on every broadcast, so a fresh
 *     client picks up the advanced sequence once the pending tx lands.
 *
 * A single retry after a short delay clears the common "pending tx not yet
 * committed" case. We do NOT loop — a persistently wedged account (a tx stuck
 * in the mempool indefinitely) surfaces the error so it isn't silently masked.
 *
 * Gameplay actions must NOT use this — they're unordered and never carry a
 * sequence, so they can't hit a sequence mismatch. Use withSigningClientRetry.
 */
export const SEQUENCE_RETRY_DELAY_MS = 1500;

export async function withMoneyMoverRetry<T>(
    network: NetworkEndpoints,
    fn: (client: SigningClientResult) => Promise<T>
): Promise<T> {
    const client = await getSigningClient(network);
    try {
        return await fn(client);
    } catch (err) {
        const sequenceMismatch = isSequenceMismatchError(err);
        if (!isTransportError(err) && !sequenceMismatch) {
            throw err;
        }
        // Force a fresh client so the retry re-queries the account sequence.
        clearSigningClientCache();
        if (sequenceMismatch) {
            // Give the pending money-mover a chance to commit so the re-query
            // returns the advanced sequence instead of the same stale value.
            await new Promise(resolve => setTimeout(resolve, SEQUENCE_RETRY_DELAY_MS));
        }
        const fresh = await getSigningClient(network);
        return fn(fresh);
    }
}

/**
 * Heuristic: does this error look like a dead RPC connection rather than
 * a chain-level rejection? We err on the side of NOT retrying — a false
 * negative here just means we don't retry a recoverable failure; a false
 * positive could double-submit a tx that was actually rejected.
 */
export function isTransportError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const message = (err as { message?: unknown }).message;
    if (typeof message !== "string") return false;
    const lower = message.toLowerCase();
    return (
        lower.includes("network") ||
        lower.includes("fetch") ||
        lower.includes("socket") ||
        lower.includes("econnreset") ||
        lower.includes("econnrefused") ||
        lower.includes("etimedout") ||
        lower.includes("disconnected") ||
        lower.includes("connection")
    );
}
