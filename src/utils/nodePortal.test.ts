import {
    appTomlSnippet,
    base64ToHex,
    configTomlSnippet,
    faultTolerance,
    parseConsensusPubkey,
    parseMicroAmount,
    peerString,
    powerShareBps,
    stateSyncTrustHeight,
    wouldControlLiveness
} from "./nodePortal";

const KEY = "yms5I2DE89yttv0SOtYilrj5CfR7QeceDJhvqp0N7d0=";

describe("parseConsensusPubkey", () => {
    it("accepts show-validator JSON", () => {
        expect(parseConsensusPubkey(`{"@type":"/cosmos.crypto.ed25519.PubKey","key":"${KEY}"}`)).toEqual({ ok: true, value: KEY });
    });
    it("accepts a bare base64 key, trimmed", () => {
        expect(parseConsensusPubkey(`  ${KEY}\n`)).toEqual({ ok: true, value: KEY });
    });
    it("rejects empty, bad JSON, wrong key type and wrong length", () => {
        expect(parseConsensusPubkey("").ok).toBe(false);
        expect(parseConsensusPubkey("{not json").ok).toBe(false);
        expect(parseConsensusPubkey(`{"@type":"/cosmos.crypto.secp256k1.PubKey","key":"${KEY}"}`).ok).toBe(false);
        expect(parseConsensusPubkey(`{"@type":"/cosmos.crypto.ed25519.PubKey"}`).ok).toBe(false);
        expect(parseConsensusPubkey("A".repeat(43)).ok).toBe(false);
        expect(parseConsensusPubkey("b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p").ok).toBe(false);
    });
});

describe("parseMicroAmount", () => {
    it("parses whole and fractional amounts without floats", () => {
        expect(parseMicroAmount("10")).toEqual({ ok: true, value: 10_000_000n });
        expect(parseMicroAmount("10.5")).toEqual({ ok: true, value: 10_500_000n });
        expect(parseMicroAmount("0.000001")).toEqual({ ok: true, value: 1n });
    });
    it("rejects junk and excess precision", () => {
        for (const bad of ["", "abc", "-1", "1e6", "0.0000001", "1,000"]) {
            expect(parseMicroAmount(bad).ok).toBe(false);
        }
    });
});

describe("faultTolerance", () => {
    const ten = 10_000_000n;
    it("is zero with three equal validators (all three must sign)", () => {
        expect(faultTolerance([ten, ten, ten])).toBe(0);
    });
    it("tolerates one outage with four equal validators", () => {
        expect(faultTolerance([ten, ten, ten, ten])).toBe(1);
    });
    it("tolerates two with seven equal validators", () => {
        expect(faultTolerance(Array(7).fill(ten))).toBe(2);
    });
    it("counts the largest validators failing first", () => {
        // 50 of 80 power in one validator: losing it halts the chain.
        expect(faultTolerance([50n, 10n, 10n, 10n])).toBe(0);
    });
    it("is zero for an empty set", () => {
        expect(faultTolerance([])).toBe(0);
    });
});

describe("powerShareBps / wouldControlLiveness", () => {
    const three = [10n, 10n, 10n];
    it("computes the new validator's share", () => {
        expect(powerShareBps(three, 10n)).toBe(2500);
    });
    it("flags a bond that alone reaches 1/3 of the power", () => {
        expect(wouldControlLiveness(three, 10n)).toBe(false);
        expect(wouldControlLiveness(three, 15n)).toBe(true); // exactly 1/3 of 45
        expect(wouldControlLiveness(three, 100n)).toBe(true);
    });
});

describe("stateSyncTrustHeight", () => {
    it("trusts a height just below the most recent snapshot", () => {
        expect(stateSyncTrustHeight(344_805, 1000)).toBe(343_900);
        expect(stateSyncTrustHeight(345_000, 1000)).toBe(344_900);
    });
    it("never goes below 1", () => {
        expect(stateSyncTrustHeight(50, 1000)).toBe(1);
    });
});

describe("base64ToHex", () => {
    it("converts a block hash to uppercase hex", () => {
        expect(base64ToHex("AAEC/w==")).toBe("000102FF");
    });
});

describe("config snippets", () => {
    const peers = [{ name: "a", nodeId: "id1", address: "1.2.3.4:26656" }, { name: "b", nodeId: "id2", address: "5.6.7.8:26656" }];
    it("joins peers as id@host:port", () => {
        expect(peerString(peers)).toBe("id1@1.2.3.4:26656,id2@5.6.7.8:26656");
    });
    it("renders seeds, PEX and state sync in config.toml", () => {
        const s = configTomlSnippet({ validators: peers, seeds: peers, rpcServers: ["http://r1", "http://r2"], trustHeight: 900, trustHash: "ABC" });
        expect(s).toContain('seeds = "id1@1.2.3.4:26656,id2@5.6.7.8:26656"');
        expect(s).toContain("pex = true");
        expect(s).toContain('rpc_servers = "http://r1,http://r2"');
        expect(s).toContain("trust_height = 900");
        expect(s).toContain('trust_hash = "ABC"');
    });
    it("renders the embedded engine and gasless fee in app.toml", () => {
        const s = appTomlSnippet(1000, "usdc");
        expect(s).toContain('embedded_engine = "embedded"');
        expect(s).toContain('minimum-gas-prices = "0usdc"');
        expect(s).toContain("snapshot-interval = 1000");
    });
});
