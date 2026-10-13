// Other players' NFT avatars (ui#774): Alchemy's cached image first, then the
// tokenURI metadata through every IPFS gateway, with per-token caching.

const RPC = "https://eth-mainnet.g.alchemy.com/v2/test-key";
const CONTRACT = "0xb3021fb8e5d96a07132032a50c5f79a64f55b2b5";
const META_CID = "QmP8PeSkG2VA2aoQDuXrkKSj4JNfBXviS8fUGpi6yUrsXK";
const IMAGE_CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiRjZyjRixdwxus";

// ABI-encode a string the way an eth_call returns tokenURI().
const abiString = (s: string): string => {
    const hex = Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2, "0")).join("");
    const word = (n: number) => n.toString(16).padStart(64, "0");
    return "0x" + word(32) + word(s.length) + hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
};

const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

const loadResolver = (route: Route) => {
    process.env.VITE_MAINNET_RPC_URL = RPC;
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(init?.method === "POST" ? `POST ${url} ${String(init.body)}` : url);
        return route(url, init);
    }) as typeof fetch;
    let mod!: typeof import("./nftImageResolver");
    jest.isolateModules(() => {
        mod = require("./nftImageResolver");
    });
    return { mod, calls };
};

// Alchemy has no cached image; tokenURI resolves to IPFS metadata.
const noAlchemy: Route = (url, init) => {
    if (url.includes("/getNFTMetadata")) return json({ image: {} });
    if (init?.method === "POST") return json({ result: abiString(`ipfs://${META_CID}/390`) });
    throw new Error(`unexpected fetch ${url}`);
};

beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.VITE_MAINNET_RPC_URL;
});

describe("alchemyNftMetadataUrl", () => {
    it("builds the v3 getNFTMetadata URL from an Alchemy RPC URL", () => {
        const { mod } = loadResolver(noAlchemy);
        expect(mod.alchemyNftMetadataUrl(RPC, CONTRACT, "390")).toBe(
            `https://eth-mainnet.g.alchemy.com/nft/v3/test-key/getNFTMetadata?contractAddress=${CONTRACT}&tokenId=390`
        );
    });

    it("is empty for a non-Alchemy RPC URL", () => {
        const { mod } = loadResolver(noAlchemy);
        expect(mod.alchemyNftMetadataUrl("https://rpc.example.org", CONTRACT, "390")).toBe("");
    });
});

describe("resolveNftImageUrl", () => {
    it("prefers Alchemy's cached CDN image and never touches IPFS", async () => {
        const { mod, calls } = loadResolver(url => {
            if (url.includes("/getNFTMetadata")) return json({ image: { cachedUrl: "https://nft-cdn.alchemy.com/eth-mainnet/abc" } });
            throw new Error(`unexpected fetch ${url}`);
        });
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBe("https://nft-cdn.alchemy.com/eth-mainnet/abc");
        expect(calls).toHaveLength(1);
    });

    it("walks the gateways for the metadata when the first one fails (the dweb.link 503)", async () => {
        const { IPFS_GATEWAYS } = require("./ipfs");
        const { mod, calls } = loadResolver((url, init) => {
            if (url.startsWith(`${IPFS_GATEWAYS[0]}/ipfs/`)) return json({}, 503);
            if (url.startsWith(`${IPFS_GATEWAYS[1]}/ipfs/`)) throw new TypeError("Failed to fetch");
            if (url.startsWith(`${IPFS_GATEWAYS[2]}/ipfs/${META_CID}/390`)) return json({ image: `ipfs://${IMAGE_CID}/390` });
            return noAlchemy(url, init);
        });
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBe(`${IPFS_GATEWAYS[0]}/ipfs/${IMAGE_CID}/390`);
        expect(calls.filter(c => c.includes(`/ipfs/${META_CID}/390`))).toHaveLength(3);
    });

    it("returns null when every source fails, and caches the failure", async () => {
        const { mod, calls } = loadResolver((url, init) => {
            if (url.includes("/ipfs/")) return json({}, 503);
            if (init?.method === "POST" && String(init.body).includes("0x6c0360eb")) return json({ result: "0x" });
            return noAlchemy(url, init);
        });
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBeNull();
        const first = calls.length;
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBeNull();
        expect(calls.length).toBe(first);
    });

    it("resolves a token once: concurrent and repeat lookups share the result", async () => {
        const { mod, calls } = loadResolver(url => {
            if (url.includes("/getNFTMetadata")) return json({ image: { cachedUrl: "https://cdn.example/390.png" } });
            throw new Error(`unexpected fetch ${url}`);
        });
        const [a, b] = await Promise.all([mod.resolveNftImageUrl(CONTRACT, "390"), mod.resolveNftImageUrl(CONTRACT.toUpperCase().replace("0X", "0x"), "390")]);
        await mod.resolveNftImageUrl(CONTRACT, "390");
        expect([a, b]).toEqual(["https://cdn.example/390.png", "https://cdn.example/390.png"]);
        expect(calls).toHaveLength(1);
    });

    it("reuses a success from localStorage across reloads", async () => {
        loadResolver(url => {
            if (url.includes("/getNFTMetadata")) return json({ image: { cachedUrl: "https://cdn.example/390.png" } });
            throw new Error(`unexpected fetch ${url}`);
        }).mod.resolveNftImageUrl(CONTRACT, "390");
        await new Promise(r => setTimeout(r, 0));
        const { mod, calls } = loadResolver(url => {
            throw new Error(`unexpected fetch ${url}`);
        });
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBe("https://cdn.example/390.png");
        expect(calls).toHaveLength(0);
    });

    it("never rejects, even when fetch itself throws everywhere", async () => {
        const { mod } = loadResolver(() => {
            throw new TypeError("Failed to fetch");
        });
        await expect(mod.resolveNftImageUrl(CONTRACT, "390")).resolves.toBeNull();
    });
});
