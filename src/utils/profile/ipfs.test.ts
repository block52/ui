import { parseIpfsRef, ipfsGatewayUrl, ipfsCandidateUrls, IPFS_GATEWAYS, normalizeIpfsUri, toCanonicalAvatarRef, isAllowedAvatarUrl } from "./ipfs";

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

describe("bare CIDs and candidate URLs (ui#774)", () => {
    const V0 = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiRjZyjRixdwxus"; // a real CIDv0 (the test CID above is not base58)
    const V1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    it("parses a bare CIDv0 with and without a path", () => {
        expect(parseIpfsRef(`${V0}/390`)).toEqual({ cid: V0, path: "390" });
        expect(parseIpfsRef(V0)).toEqual({ cid: V0, path: "" });
    });

    it("parses a bare base32 CIDv1", () => {
        expect(parseIpfsRef(V1)).toEqual({ cid: V1, path: "" });
    });

    it("does not mistake an ordinary string for a CID", () => {
        expect(parseIpfsRef("avatar.png")).toBeNull();
        expect(parseIpfsRef("Qmshort/390")).toBeNull();
    });

    it("yields one URL per gateway for every IPFS form", () => {
        for (const input of [`ipfs://${V0}/390`, `ipfs://ipfs/${V0}/390`, `${V0}/390`, `https://dweb.link/ipfs/${V0}/390`]) {
            expect(ipfsCandidateUrls(input)).toEqual(IPFS_GATEWAYS.map(gw => `${gw}/ipfs/${V0}/390`));
        }
    });

    it("passes ar://, https and data: through as a single candidate", () => {
        expect(ipfsCandidateUrls("ar://abc123")).toEqual(["https://arweave.net/abc123"]);
        expect(ipfsCandidateUrls("https://cdn.example/a.png")).toEqual(["https://cdn.example/a.png"]);
        expect(ipfsCandidateUrls("data:image/png;base64,AAA")).toEqual(["data:image/png;base64,AAA"]);
    });

    it("yields nothing for empty input", () => {
        expect(ipfsCandidateUrls("")).toEqual([]);
        expect(ipfsCandidateUrls(undefined)).toEqual([]);
        expect(ipfsCandidateUrls(null)).toEqual([]);
    });

    it("no longer lists the shut-down cloudflare-ipfs.com gateway", () => {
        expect(IPFS_GATEWAYS.some(gw => gw.includes("cloudflare-ipfs.com"))).toBe(false);
    });
});

