import { buildPlayerAvatar, parsePlayerAvatar } from "./avatarPayload";
import { IPFS_GATEWAYS } from "./ipfs";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiExampleExampleCid";
const CONTRACT = "0xb302a1a29c082ff8a20d5f650f3e7e7f4d2b2b50";

describe("buildPlayerAvatar (#625)", () => {
    it("stores the CONTENT ADDRESS, not a gateway URL, for an ipfs:// image", () => {
        const payload = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "390", imageUrl: `ipfs://${CID}/390` });
        expect(payload).toBe(`nft:eip155:1/erc721:${CONTRACT}/390|ipfs://${CID}/390`);
    });

    it("canonicalises a gateway URL down to ipfs:// before storing", () => {
        const payload = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "390", imageUrl: `https://ipfs.io/ipfs/${CID}/390` });
        expect(payload).toContain(`|ipfs://${CID}/390`);
        expect(payload).not.toContain("ipfs.io");
    });

    it("keeps a CDN URL (Alchemy) as-is", () => {
        const cdn = "https://nft2-cdn.alchemy.com/eth-mainnet/abc123";
        const payload = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "390", imageUrl: cdn });
        expect(payload).toBe(`nft:eip155:1/erc721:${CONTRACT}/390|${cdn}`);
    });
});

describe("parsePlayerAvatar (#625)", () => {
    it("re-homes a legacy ipfs.io payload onto the configured gateway on read", () => {
        const legacy = `nft:eip155:1/erc721:${CONTRACT}/390|https://ipfs.io/ipfs/${CID}/390`;
        const parsed = parsePlayerAvatar(legacy);
        expect(parsed?.format).toBe("nft");
        expect(parsed?.avatarUrl).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
        expect(parsed?.contractAddress).toBe(CONTRACT);
        expect(parsed?.tokenId).toBe("390");
    });

    it("renders a canonical ipfs:// payload through the gateway", () => {
        const parsed = parsePlayerAvatar(`nft:eip155:1/erc721:${CONTRACT}/390|ipfs://${CID}/390`);
        expect(parsed?.avatarUrl).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
    });

    it("round-trips build → parse to a renderable URL", () => {
        const payload = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "390", imageUrl: `ipfs://${CID}/390` });
        const parsed = parsePlayerAvatar(payload);
        expect(parsed?.avatarUrl).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
    });

    it("returns null for empty input", () => {
        expect(parsePlayerAvatar("")).toBeNull();
        expect(parsePlayerAvatar(null)).toBeNull();
    });
});
