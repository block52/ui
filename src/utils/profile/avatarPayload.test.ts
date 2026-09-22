/**
 * Tests for the on-chain avatar payload (ui#625).
 *
 * `buildPlayerAvatar` produces what `MsgRegisterNftAvatar` writes to chain
 * state, and we cannot rewrite that afterwards — so it must carry the content
 * address, never a gateway. `parsePlayerAvatar` has to keep every avatar that
 * was already registered with a baked-in `ipfs.io` URL working.
 */
import { buildPlayerAvatar, parsePlayerAvatar } from "./avatarPayload";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiabcdefghijklmn";
const CONTRACT = "0x1234567890abcdef1234567890abcdef12345678";

describe("buildPlayerAvatar", () => {
    const original = process.env.VITE_IPFS_GATEWAYS;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.VITE_IPFS_GATEWAYS;
        } else {
            process.env.VITE_IPFS_GATEWAYS = original;
        }
    });

    it("stores the content address, not the gateway that happened to resolve it", () => {
        const payload = buildPlayerAvatar({
            chainId: 1,
            contractAddress: CONTRACT,
            tokenId: "390",
            imageUrl: `https://ipfs.io/ipfs/${CID}/390`
        });

        expect(payload).toBe(`nft:eip155:1/erc721:${CONTRACT}/390|ipfs://${CID}/390`);
        expect(payload).not.toContain("ipfs.io");
    });

    it("does not change what it stores when the configured gateway changes", () => {
        process.env.VITE_IPFS_GATEWAYS = "https://first.example/ipfs/";
        const withFirst = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "1", imageUrl: `ipfs://${CID}/1` });

        process.env.VITE_IPFS_GATEWAYS = "https://second.example/ipfs/";
        const withSecond = buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "1", imageUrl: `ipfs://${CID}/1` });

        expect(withFirst).toBe(withSecond);
    });

    it("leaves a non-IPFS image URL alone", () => {
        expect(
            buildPlayerAvatar({ chainId: 1, contractAddress: CONTRACT, tokenId: "7", imageUrl: "https://cdn.example/a.png" })
        ).toBe(`nft:eip155:1/erc721:${CONTRACT}/7|https://cdn.example/a.png`);
    });
});

describe("parsePlayerAvatar", () => {
    const original = process.env.VITE_IPFS_GATEWAYS;

    beforeEach(() => {
        process.env.VITE_IPFS_GATEWAYS = "https://first.example/ipfs/,https://second.example/ipfs/";
    });

    afterEach(() => {
        if (original === undefined) {
            delete process.env.VITE_IPFS_GATEWAYS;
        } else {
            process.env.VITE_IPFS_GATEWAYS = original;
        }
    });

    it("re-routes an avatar already registered against ipfs.io onto the configured chain", () => {
        const parsed = parsePlayerAvatar(`nft:eip155:1/erc721:${CONTRACT}/390|https://ipfs.io/ipfs/${CID}/390`);

        expect(parsed).not.toBeNull();
        expect(parsed!.format).toBe("nft");
        expect(parsed!.chainId).toBe(1);
        expect(parsed!.contractAddress).toBe(CONTRACT);
        expect(parsed!.tokenId).toBe("390");
        expect(parsed!.avatarUrl).toBe(`https://first.example/ipfs/${CID}/390`);
        expect(parsed!.avatarUrlCandidates).toEqual([
            `https://first.example/ipfs/${CID}/390`,
            `https://second.example/ipfs/${CID}/390`
        ]);
    });

    it("reads a canonically stored avatar", () => {
        const parsed = parsePlayerAvatar(`nft:eip155:1/erc721:${CONTRACT}/390|ipfs://${CID}/390`);

        expect(parsed!.avatarUrl).toBe(`https://first.example/ipfs/${CID}/390`);
        expect(parsed!.avatarUrlCandidates).toHaveLength(2);
    });

    it("round-trips what buildPlayerAvatar wrote", () => {
        const payload = buildPlayerAvatar({
            chainId: 1,
            contractAddress: CONTRACT,
            tokenId: "390",
            imageUrl: `https://ipfs.io/ipfs/${CID}/390`
        });
        const parsed = parsePlayerAvatar(payload);

        expect(parsed!.tokenId).toBe("390");
        expect(parsed!.avatarUrl).toBe(`https://first.example/ipfs/${CID}/390`);
    });

    it("handles a plain URL avatar", () => {
        const parsed = parsePlayerAvatar("https://cdn.example/a.png");

        expect(parsed!.format).toBe("url");
        expect(parsed!.avatarUrl).toBe("https://cdn.example/a.png");
        expect(parsed!.avatarUrlCandidates).toEqual(["https://cdn.example/a.png"]);
    });

    it("returns null for nothing and for an unusable value", () => {
        expect(parsePlayerAvatar(null)).toBeNull();
        expect(parsePlayerAvatar(undefined)).toBeNull();
        expect(parsePlayerAvatar("")).toBeNull();
        expect(parsePlayerAvatar("   ")).toBeNull();
        expect(parsePlayerAvatar("ftp://example.com/a.png")).toBeNull();
    });
});
