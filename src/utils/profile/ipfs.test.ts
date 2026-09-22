/**
 * Tests for IPFS reference handling (ui#625).
 *
 * The regression this guards: every avatar was fetched from a hardcoded
 * `ipfs.io`, which answered 403 with `Cross-Origin-Resource-Policy:
 * same-origin` and the browser blocked the image. A CID identifies the bytes,
 * not the host — so every form of reference has to reduce to the same
 * `{ cid, path }`, and there has to be a second gateway to try.
 */
import {
    getIpfsGateways,
    ipfsCandidateUrls,
    ipfsGatewayUrl,
    ipfsRefToUri,
    isAllowedAvatarUrl,
    normalizeIpfsUri,
    parseIpfsRef,
    toCanonicalIpfsUri
} from "./ipfs";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiabcdefghijklmn";
const CIDV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

describe("parseIpfsRef", () => {
    it("reduces every form we see to the same reference", () => {
        const expected = { cid: CID, path: "390" };

        expect(parseIpfsRef(`ipfs://${CID}/390`)).toEqual(expected);
        expect(parseIpfsRef(`ipfs://ipfs/${CID}/390`)).toEqual(expected);
        expect(parseIpfsRef(`https://ipfs.io/ipfs/${CID}/390`)).toEqual(expected);
        expect(parseIpfsRef(`https://dweb.link/ipfs/${CID}/390`)).toEqual(expected);
        expect(parseIpfsRef(`https://my-gw.mypinata.cloud/ipfs/${CID}/390`)).toEqual(expected);
        expect(parseIpfsRef(`https://${CID}.ipfs.dweb.link/390`)).toEqual(expected);
        expect(parseIpfsRef(`  ipfs://${CID}/390  `)).toEqual(expected);
    });

    it("handles a bare CID with no path", () => {
        expect(parseIpfsRef(`ipfs://${CID}`)).toEqual({ cid: CID, path: "" });
        expect(parseIpfsRef(`https://ipfs.io/ipfs/${CID}`)).toEqual({ cid: CID, path: "" });
        expect(parseIpfsRef(`https://${CID}.ipfs.w3s.link`)).toEqual({ cid: CID, path: "" });
    });

    it("handles a CIDv1", () => {
        expect(parseIpfsRef(`ipfs://${CIDV1}/meta.json`)).toEqual({ cid: CIDV1, path: "meta.json" });
        expect(parseIpfsRef(`https://${CIDV1}.ipfs.dweb.link/meta.json`)).toEqual({ cid: CIDV1, path: "meta.json" });
    });

    it("keeps a nested path intact", () => {
        expect(parseIpfsRef(`ipfs://${CID}/images/large/390.png`)).toEqual({ cid: CID, path: "images/large/390.png" });
    });

    it("returns null for anything that is not IPFS", () => {
        expect(parseIpfsRef(null)).toBeNull();
        expect(parseIpfsRef(undefined)).toBeNull();
        expect(parseIpfsRef("")).toBeNull();
        expect(parseIpfsRef("   ")).toBeNull();
        expect(parseIpfsRef("https://example.com/avatar.png")).toBeNull();
        expect(parseIpfsRef("data:image/png;base64,AAAA")).toBeNull();
        expect(parseIpfsRef("ar://abc123")).toBeNull();
        expect(parseIpfsRef("not a url at all")).toBeNull();
    });

    it("rejects a path segment that is not a CID", () => {
        expect(parseIpfsRef("https://example.com/ipfs/logo.png")).toBeNull();
        expect(parseIpfsRef("ipfs://short")).toBeNull();
    });
});

describe("ipfsRefToUri / ipfsGatewayUrl", () => {
    it("round-trips through the canonical form", () => {
        const ref = parseIpfsRef(`https://ipfs.io/ipfs/${CID}/390`)!;
        expect(ipfsRefToUri(ref)).toBe(`ipfs://${CID}/390`);
        expect(parseIpfsRef(ipfsRefToUri(ref))).toEqual(ref);
    });

    it("renders against a gateway written with or without /ipfs/", () => {
        const ref = { cid: CID, path: "390" };
        expect(ipfsGatewayUrl(ref, "https://dweb.link")).toBe(`https://dweb.link/ipfs/${CID}/390`);
        expect(ipfsGatewayUrl(ref, "https://dweb.link/")).toBe(`https://dweb.link/ipfs/${CID}/390`);
        expect(ipfsGatewayUrl(ref, "https://dweb.link/ipfs/")).toBe(`https://dweb.link/ipfs/${CID}/390`);
        expect(ipfsGatewayUrl({ cid: CID, path: "" }, "https://dweb.link")).toBe(`https://dweb.link/ipfs/${CID}`);
    });
});

describe("getIpfsGateways", () => {
    const original = process.env.VITE_IPFS_GATEWAYS;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.VITE_IPFS_GATEWAYS;
        } else {
            process.env.VITE_IPFS_GATEWAYS = original;
        }
    });

    it("falls back to the public chain when unconfigured", () => {
        delete process.env.VITE_IPFS_GATEWAYS;
        const gateways = getIpfsGateways();
        expect(gateways.length).toBeGreaterThan(1);
        expect(gateways.every(gateway => gateway.endsWith("/ipfs/"))).toBe(true);
    });

    it("uses the configured chain, in order, ignoring blanks and stray slashes", () => {
        process.env.VITE_IPFS_GATEWAYS = " https://ours.example/ipfs/ , , https://dweb.link// ";
        expect(getIpfsGateways()).toEqual(["https://ours.example/ipfs/", "https://dweb.link/ipfs/"]);
    });

    it("falls back when the variable is set to nothing usable", () => {
        process.env.VITE_IPFS_GATEWAYS = " , ";
        expect(getIpfsGateways().length).toBeGreaterThan(1);
    });
});

describe("ipfsCandidateUrls", () => {
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

    it("offers one URL per gateway, in priority order", () => {
        expect(ipfsCandidateUrls(`ipfs://${CID}/390`)).toEqual([
            `https://first.example/ipfs/${CID}/390`,
            `https://second.example/ipfs/${CID}/390`
        ]);
    });

    it("re-routes an already-registered ipfs.io URL onto the configured chain", () => {
        // This is what makes avatars already written to chain state survive.
        expect(ipfsCandidateUrls(`https://ipfs.io/ipfs/${CID}/390`)).toEqual([
            `https://first.example/ipfs/${CID}/390`,
            `https://second.example/ipfs/${CID}/390`
        ]);
    });

    it("passes an ordinary URL straight through as the only candidate", () => {
        expect(ipfsCandidateUrls("https://example.com/a.png")).toEqual(["https://example.com/a.png"]);
        expect(ipfsCandidateUrls("data:image/png;base64,AAAA")).toEqual(["data:image/png;base64,AAAA"]);
    });

    it("still resolves arweave", () => {
        expect(ipfsCandidateUrls("ar://abc123")).toEqual(["https://arweave.net/abc123"]);
    });

    it("is empty for nothing", () => {
        expect(ipfsCandidateUrls(null)).toEqual([]);
        expect(ipfsCandidateUrls("")).toEqual([]);
        expect(ipfsCandidateUrls("   ")).toEqual([]);
    });

    it("normalizeIpfsUri is the first candidate", () => {
        expect(normalizeIpfsUri(`ipfs://${CID}/390`)).toBe(`https://first.example/ipfs/${CID}/390`);
        expect(normalizeIpfsUri(null)).toBe("");
    });
});

describe("toCanonicalIpfsUri", () => {
    it("stores the content address, never the gateway", () => {
        expect(toCanonicalIpfsUri(`https://ipfs.io/ipfs/${CID}/390`)).toBe(`ipfs://${CID}/390`);
        expect(toCanonicalIpfsUri(`https://${CID}.ipfs.dweb.link/390`)).toBe(`ipfs://${CID}/390`);
        expect(toCanonicalIpfsUri(`ipfs://${CID}/390`)).toBe(`ipfs://${CID}/390`);
    });

    it("leaves a non-IPFS value alone", () => {
        expect(toCanonicalIpfsUri("https://example.com/a.png")).toBe("https://example.com/a.png");
        expect(toCanonicalIpfsUri("")).toBe("");
    });
});

describe("isAllowedAvatarUrl", () => {
    it("accepts rendered URLs and rejects empties", () => {
        expect(isAllowedAvatarUrl("https://example.com/a.png")).toBe(true);
        expect(isAllowedAvatarUrl("http://example.com/a.png")).toBe(true);
        expect(isAllowedAvatarUrl("data:image/png;base64,AAAA")).toBe(true);
        expect(isAllowedAvatarUrl("")).toBe(false);
        expect(isAllowedAvatarUrl(`ipfs://${CID}`)).toBe(false);
    });
});
