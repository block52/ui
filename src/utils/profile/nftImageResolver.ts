/**
 * Resolve an NFT image URL directly from the contract's tokenURI.
 * Uses a public RPC endpoint — no wallet connection required.
 */

const ETH_RPC_URL = import.meta.env.VITE_MAINNET_RPC_URL || "";

// ERC-721 tokenURI(uint256) selector: 0xc87b56dd
const TOKEN_URI_SELECTOR = "0xc87b56dd";

/**
 * Fetch the image URL for an NFT by calling tokenURI on the contract.
 * Returns the image URL or null if it can't be resolved.
 */
export async function resolveNftImageUrl(contractAddress: string, tokenId: string): Promise<string | null> {
    if (!ETH_RPC_URL) {
        console.warn("[nftImageResolver] No RPC URL configured (VITE_MAINNET_RPC_URL)");
        return null;
    }

    try {
        // Encode tokenId as uint256 (left-padded to 32 bytes)
        const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, "0");
        const callData = TOKEN_URI_SELECTOR + tokenIdHex;

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

        const json = await response.json();
        if (!json.result || json.result === "0x") {
            return null;
        }

        // Decode ABI-encoded string response
        const tokenUri = decodeAbiString(json.result);
        if (!tokenUri) return null;

        // Fetch metadata from tokenURI
        const metadataUrl = resolveIpfsUrl(tokenUri);
        const metaResponse = await fetch(metadataUrl);
        if (!metaResponse.ok) return null;

        const metadata = await metaResponse.json();
        const imageUrl = metadata.image || metadata.image_url || null;

        return imageUrl ? resolveIpfsUrl(imageUrl) : null;
    } catch (err) {
        console.error("[nftImageResolver] Failed to resolve image:", err);
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
