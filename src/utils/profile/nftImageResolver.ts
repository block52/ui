/**
 * Resolve an NFT image URL directly from the contract's tokenURI.
 * Uses a public RPC endpoint — no wallet connection required.
 *
 * Supports multiple resolution strategies:
 * 1. tokenURI(tokenId) - standard ERC-721
 * 2. baseURI() + tokenId - for contracts using baseURI pattern (including proxies)
 */

const ETH_RPC_URL = import.meta.env.VITE_MAINNET_RPC_URL || "";

// ERC-721 function selectors
const TOKEN_URI_SELECTOR = "0xc87b56dd";  // tokenURI(uint256)
const BASE_URI_SELECTOR = "0x6c0360eb";   // baseURI()

/**
 * Fetch the image URL for an NFT by calling tokenURI on the contract.
 * Falls back to baseURI + tokenId pattern for proxy contracts.
 * Returns the image URL or null if it can't be resolved.
 */
export async function resolveNftImageUrl(contractAddress: string, tokenId: string): Promise<string | null> {
    if (!ETH_RPC_URL) {
        console.warn("[nftImageResolver] No RPC URL configured (VITE_MAINNET_RPC_URL)");
        return null;
    }

    // Try tokenURI(tokenId) first (standard ERC-721)
    const tokenUriResult = await tryTokenUri(contractAddress, tokenId);
    if (tokenUriResult) {
        return tokenUriResult;
    }

    // Fallback: try baseURI() + tokenId pattern (common with proxy contracts)
    const baseUriResult = await tryBaseUri(contractAddress, tokenId);
    if (baseUriResult) {
        return baseUriResult;
    }

    return null;
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
    const response = await fetch(ETH_RPC_URL, {
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
 * Fetch metadata from tokenURI and extract image URL
 */
async function fetchMetadataImage(tokenUri: string): Promise<string | null> {
    try {
        const metadataUrl = resolveIpfsUrl(tokenUri);
        const metaResponse = await fetch(metadataUrl);
        if (!metaResponse.ok) return null;

        const metadata = await metaResponse.json();
        const imageUrl = metadata.image || metadata.image_url || null;

        return imageUrl ? resolveIpfsUrl(imageUrl) : null;
    } catch (err) {
        console.error("[nftImageResolver] Failed to fetch metadata:", err);
        return null;
    }
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

/** Convert ipfs:// URLs to a public gateway */
function resolveIpfsUrl(url: string): string {
    if (url.startsWith("ipfs://")) {
        return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return url;
}
