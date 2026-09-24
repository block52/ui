import { parseIpfsRef, ipfsGatewayUrl, IPFS_GATEWAYS, normalizeIpfsUri, toCanonicalAvatarRef, isAllowedAvatarUrl } from "./ipfs";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiExampleExampleCid";

describe("parseIpfsRef (#625)", () => {
    it("parses an ipfs:// ref with a path", () => {
        expect(parseIpfsRef(`ipfs://${CID}/390`)).toEqual({ cid: CID, path: "390" });
    });

    it("parses an ipfs:// ref without a path", () => {
        expect(parseIpfsRef(`ipfs://${CID}`)).toEqual({ cid: CID, path: "" });
    });

    it("tolerates the ipfs://ipfs/<cid> double-prefix form", () => {
        expect(parseIpfsRef(`ipfs://ipfs/${CID}/390`)).toEqual({ cid: CID, path: "390" });
    });

    it("parses a path gateway URL (ipfs.io) back to the ref", () => {
        expect(parseIpfsRef(`https://ipfs.io/ipfs/${CID}/390`)).toEqual({ cid: CID, path: "390" });
    });

    it("parses another path gateway (dweb.link) back to the same ref", () => {
        expect(parseIpfsRef(`https://dweb.link/ipfs/${CID}/390`)).toEqual({ cid: CID, path: "390" });
    });

    it("parses a subdomain gateway URL back to the ref", () => {
        expect(parseIpfsRef(`https://${CID}.ipfs.dweb.link/390`)).toEqual({ cid: CID, path: "390" });
    });

    it("returns null for a non-IPFS CDN URL", () => {
        expect(parseIpfsRef("https://nft2-cdn.alchemy.com/eth-mainnet/abc123")).toBeNull();
    });

    it("returns null for data: and empty", () => {
        expect(parseIpfsRef("data:image/png;base64,AAAA")).toBeNull();
        expect(parseIpfsRef("")).toBeNull();
        expect(parseIpfsRef(null)).toBeNull();
    });
});

describe("ipfsGatewayUrl", () => {
    const ref = { cid: CID, path: "390" };

    it("renders through the gateway at the given index", () => {
        expect(ipfsGatewayUrl(ref, 0)).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
        expect(ipfsGatewayUrl(ref, 1)).toBe(`${IPFS_GATEWAYS[1]}/ipfs/${CID}/390`);
    });

    it("clamps an out-of-range index to the last gateway", () => {
        expect(ipfsGatewayUrl(ref, 999)).toBe(`${IPFS_GATEWAYS[IPFS_GATEWAYS.length - 1]}/ipfs/${CID}/390`);
    });

    it("omits the slash for a pathless ref", () => {
        expect(ipfsGatewayUrl({ cid: CID, path: "" }, 0)).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}`);
    });
});

describe("normalizeIpfsUri", () => {
    it("routes an ipfs:// ref through the FIRST gateway, not ipfs.io", () => {
        const out = normalizeIpfsUri(`ipfs://${CID}/390`);
        expect(out).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
    });

    it("re-homes a legacy ipfs.io URL onto the first gateway (existing chain avatars)", () => {
        // A previously-registered avatar baked in ipfs.io; on read it moves to the
        // configured fallback gateway so it renders even when ipfs.io 403s.
        const out = normalizeIpfsUri(`https://ipfs.io/ipfs/${CID}/390`);
        expect(out).toBe(`${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
    });

    it("leaves a CDN URL unchanged", () => {
        const cdn = "https://nft2-cdn.alchemy.com/eth-mainnet/abc123";
        expect(normalizeIpfsUri(cdn)).toBe(cdn);
    });

    it("rewrites ar:// to arweave.net", () => {
        expect(normalizeIpfsUri("ar://xyz")).toBe("https://arweave.net/xyz");
    });
});

describe("toCanonicalAvatarRef", () => {
    it("canonicalises any gateway URL to ipfs://<cid>/<path> (gateway not baked in)", () => {
        expect(toCanonicalAvatarRef(`https://ipfs.io/ipfs/${CID}/390`)).toBe(`ipfs://${CID}/390`);
        expect(toCanonicalAvatarRef(`https://${CID}.ipfs.dweb.link/390`)).toBe(`ipfs://${CID}/390`);
        expect(toCanonicalAvatarRef(`ipfs://${CID}/390`)).toBe(`ipfs://${CID}/390`);
    });

    it("drops the trailing slash for a pathless ref", () => {
        expect(toCanonicalAvatarRef(`https://ipfs.io/ipfs/${CID}`)).toBe(`ipfs://${CID}`);
    });

    it("passes a CDN URL through unchanged", () => {
        const cdn = "https://nft2-cdn.alchemy.com/eth-mainnet/abc123";
        expect(toCanonicalAvatarRef(cdn)).toBe(cdn);
    });
});

describe("isAllowedAvatarUrl", () => {
    it("accepts http(s) and data:", () => {
        expect(isAllowedAvatarUrl("https://x")).toBe(true);
        expect(isAllowedAvatarUrl("http://x")).toBe(true);
        expect(isAllowedAvatarUrl("data:image/png;base64,AA")).toBe(true);
    });
    it("rejects empty / ipfs://", () => {
        expect(isAllowedAvatarUrl("")).toBe(false);
        expect(isAllowedAvatarUrl(`ipfs://${CID}`)).toBe(false);
    });
});
