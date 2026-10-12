/**
 * Resolve an NFT's image URL from its contract + token id, for avatars of
 * players other than the viewer (whose own NFTs come from getNFTsForOwner).
 *
 * Resolution order (ui#774):
 * 1. Alchemy getNFTMetadata — a cached CDN image, no public IPFS gateway, the
 *    same source the own-avatar path already uses.
 * 2. tokenURI(tokenId) — standard ERC-721 — then the metadata document.
 * 3. baseURI() + tokenId — for contracts using the baseURI pattern (incl. proxies).
 *
 * The metadata document is content-addressed like the image, so it is fetched
 * through every IPFS gateway in turn (5s each) rather than only the first: one
 * public gateway failing (dweb.link 503 in ui#774, ipfs.io 403 in ui#625) must
 * not hide the avatar. Results are cached per contract:tokenId — successes for
 * 24h (memory + localStorage), failures for 5 min — and concurrent lookups for
 * the same token share one request.
 */

import { viteEnv } from "../viteEnv";
import { ipfsCandidateUrls, normalizeIpfsUri } from "./ipfs";

const ETH_RPC_URL = viteEnv.VITE_MAINNET_RPC_URL || "";

// ERC-721 function selectors
const TOKEN_URI_SELECTOR = "0xc87b56dd"; // tokenURI(uint256)
const BASE_URI_SELECTOR = "0x6c0360eb"; // baseURI()

const FETCH_TIMEOUT_MS = 5000;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;
const STORAGE_PREFIX = "block52.nftImage.";

interface CacheEntry {
    url: string | null;
    at: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

const cacheKey = (contractAddress: string, tokenId: string): string => `${contractAddress.toLowerCase()}:${tokenId}`;

const readCache = (key: string, now: number): CacheEntry | undefined => {
    const mem = memoryCache.get(key);
    if (mem && now - mem.at < (mem.url ? SUCCESS_TTL_MS : FAILURE_TTL_MS)) {
        return mem;
    }
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (raw) {
            const stored = JSON.parse(raw) as CacheEntry;
            if (stored.url && now - stored.at < SUCCESS_TTL_MS) {
                memoryCache.set(key, stored);
                return stored;
            }
        }
    } catch {
        // Storage unavailable (private mode, quota) — memory cache only.
    }
    return undefined;
};

const writeCache = (key: string, url: string | null, now: number): void => {
    const entry = { url, at: now };
    memoryCache.set(key, entry);
    if (!url) {
        return; // failures stay in memory only, so a reload retries
    }
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
        // Storage unavailable — memory cache only.
    }
};

/** Test hook: forget every cached and in-flight lookup. */
export const clearNftImageCache = (): void => {
    memoryCache.clear();
    inFlight.clear();
};

/**
 * Fetch the image URL for an NFT. Returns null when no source can resolve it;
 * never rejects, so a caller's render can never be broken by a failed lookup.
 */
export async function resolveNftImageUrl(contractAddress: string, tokenId: string): Promise<string | null> {
    const key = cacheKey(contractAddress, tokenId);
    const cached = readCache(key, Date.now());
    if (cached) {
        return cached.url;
    }
    const pending = inFlight.get(key);
    if (pending) {
        return pending;
    }

    const lookup = resolveUncached(contractAddress, tokenId)
        .catch(err => {
            console.error("[nftImageResolver] resolution failed:", err);
            return null;
        })
        .then(url => {
            writeCache(key, url, Date.now());
            inFlight.delete(key);
            return url;
        });
    inFlight.set(key, lookup);
    return lookup;
}

async function resolveUncached(contractAddress: string, tokenId: string): Promise<string | null> {
    const alchemy = await tryAlchemyMetadata(contractAddress, tokenId);
    if (alchemy) {
        return alchemy;
    }

    if (!ETH_RPC_URL) {
        console.warn("[nftImageResolver] No RPC URL configured (VITE_MAINNET_RPC_URL)");
        return null;
    }

    // Try tokenURI(tokenId) first (standard ERC-721), then baseURI() + tokenId.
    return (await tryTokenUri(contractAddress, tokenId)) || (await tryBaseUri(contractAddress, tokenId));
}

const fetchWithTimeout = (url: string, init?: RequestInit): Promise<Response> => {
    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined;
    return fetch(url, { ...init, signal });
};

/** The Alchemy NFT API URL for a token, when the RPC URL is an Alchemy one. */
export const alchemyNftMetadataUrl = (rpcUrl: string, contractAddress: string, tokenId: string): string => {
    const match = rpcUrl.match(/\/v2\/([^/]+)$/);
    if (!match) {
        return "";
    }
    const host = rpcUrl.replace(/\/v2\/[^/]+$/, "");
    return `${host}/nft/v3/${match[1]}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`;
};

interface AlchemyNftMetadata {
    image?: { cachedUrl?: string; pngUrl?: string; thumbnailUrl?: string; originalUrl?: string };
    raw?: { metadata?: { image?: string } };
}

/**
 * Alchemy's cached CDN image for the token. Falls back to the original image
 * URL it reports (an ipfs:// ref renders through the gateway chain); null when
 * Alchemy is not configured or does not know the token.
 */
async function tryAlchemyMetadata(contractAddress: string, tokenId: string): Promise<string | null> {
    const url = alchemyNftMetadataUrl(ETH_RPC_URL, contractAddress, tokenId);
    if (!url) {
        return null;
    }
    try {
        const response = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
        if (!response.ok) {
            return null;
        }
        const nft = (await response.json()) as AlchemyNftMetadata;
        const image = nft.image?.cachedUrl || nft.image?.pngUrl || nft.image?.thumbnailUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
        return image ? normalizeIpfsUri(image) : null;
    } catch (err) {
        console.error("[nftImageResolver] Alchemy getNFTMetadata failed:", err);
        return null;
    }
}

/**
 * Try to resolve image using tokenURI(tokenId) call
 */
async function tryTokenUri(contractAddress: string, tokenId: string): Promise<string | null> {
    try {
        const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, "0");
        const callData = TOKEN_URI_SELECTOR + tokenIdHex;

        const json = await ethCall(contractAddress, callData);
        if (!json.result || json.result === "0x" || json.error) {
            return null;
        }

        const tokenUri = decodeAbiString(json.result);
        if (!tokenUri) return null;

        return fetchMetadataImage(tokenUri);
    } catch (err) {
        console.error("[nftImageResolver] tokenURI failed:", err);
        return null;
    }
}

/**
 * Try to resolve image using baseURI() + tokenId pattern
 * Common with proxy contracts and lazy-mint collections
 */
async function tryBaseUri(contractAddress: string, tokenId: string): Promise<string | null> {
    try {
        const json = await ethCall(contractAddress, BASE_URI_SELECTOR);
        if (!json.result || json.result === "0x" || json.error) {
            return null;
        }

        const baseUri = decodeAbiString(json.result);
        if (!baseUri) return null;

        // Construct full tokenURI: baseURI + tokenId
        // Handle both "ipfs://xxx/" and "ipfs://xxx" patterns
        const separator = baseUri.endsWith("/") ? "" : "/";
        const tokenUri = baseUri + separator + tokenId;

        return fetchMetadataImage(tokenUri);
    } catch (err) {
        console.error("[nftImageResolver] baseURI failed:", err);
        return null;
    }
}

/**
 * Make an eth_call to the contract
 */
async function ethCall(contractAddress: string, callData: string): Promise<{ result?: string; error?: unknown }> {
    const response = await fetchWithTimeout(ETH_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to: contractAddress, data: callData }, "latest"]
        })
    });
    return response.json();
}

/**
 * Fetch the metadata document at tokenUri and extract its image URL, trying
 * every gateway for an IPFS tokenUri until one answers. The image itself is not
 * fetched: it goes to an <img>, whose onError walks the gateways again.
 */
export async function fetchMetadataImage(tokenUri: string): Promise<string | null> {
    for (const metadataUrl of ipfsCandidateUrls(tokenUri)) {
        try {
            const metaResponse = await fetchWithTimeout(metadataUrl);
            if (!metaResponse.ok) {
                continue;
            }
            const metadata = await metaResponse.json();
            const imageUrl = metadata.image || metadata.image_url || null;
            return imageUrl ? normalizeIpfsUri(imageUrl) : null;
        } catch (err) {
            console.warn("[nftImageResolver] metadata fetch failed, trying next source:", metadataUrl, err);
        }
    }
    return null;
}

/** Decode an ABI-encoded string from an eth_call result */
function decodeAbiString(hex: string): string | null {
    try {
        // Remove 0x prefix
        const data = hex.startsWith("0x") ? hex.slice(2) : hex;
        // First 32 bytes = offset, next 32 bytes = length
        const length = parseInt(data.slice(64, 128), 16);
        // Read the string bytes
        const strHex = data.slice(128, 128 + length * 2);
        return decodeURIComponent(strHex.replace(/../g, "%$&"));
    } catch {
        return null;
    }
}
