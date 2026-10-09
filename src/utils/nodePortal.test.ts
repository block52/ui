import {
    appTomlSnippet,
    base64ToHex,
    configTomlSnippet,
    faultTolerance,
    parseConsensusPubkey,
    parseLatestBlockHeight,
    parseMicroAmount,
    parseValidatorsResponse,
    peerString,
    powerShareBps,
    secondsBetween,
    shareOfTotalBps,
    sumBigInt,
    formatBps,
    formatAgo,
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
    const peers = [
        { name: "a", nodeId: "id1", address: "1.2.3.4:26656" },
        { name: "b", nodeId: "id2", address: "5.6.7.8:26656" }
    ];
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

describe("sumBigInt", () => {
    it("sums amounts", () => {
        expect(sumBigInt([10_000_000n, 20_000_000n, 5n])).toBe(30_000_005n);
    });
    it("is zero for an empty list", () => {
        expect(sumBigInt([])).toBe(0n);
    });
});

describe("shareOfTotalBps", () => {
    it("returns basis points of the total, rounded down", () => {
        expect(shareOfTotalBps(10n, 40n)).toBe(2500);
        expect(shareOfTotalBps(1n, 3n)).toBe(3333);
        expect(shareOfTotalBps(40n, 40n)).toBe(10_000);
    });
    it("returns null when there is no total", () => {
        expect(shareOfTotalBps(0n, 0n)).toBeNull();
    });
});

describe("formatBps", () => {
    it("drops trailing zeros", () => {
        expect(formatBps(2500)).toBe("25%");
        expect(formatBps(3333)).toBe("33.33%");
        expect(formatBps(1250)).toBe("12.5%");
        expect(formatBps(0)).toBe("0%");
        expect(formatBps(10_000)).toBe("100%");
    });
});

describe("secondsBetween", () => {
    it("floors to whole seconds", () => {
        expect(secondsBetween(1_000, 13_999)).toBe(12);
    });
    it("never goes negative", () => {
        expect(secondsBetween(5_000, 1_000)).toBe(0);
    });
});

describe("formatAgo", () => {
    it("formats seconds, minutes and hours", () => {
        expect(formatAgo(0)).toBe("just now");
        expect(formatAgo(12)).toBe("12s ago");
        expect(formatAgo(75)).toBe("1m ago");
        expect(formatAgo(7200)).toBe("2h ago");
    });
});

describe("parseValidatorsResponse", () => {
    it("reads moniker, operator address and status", () => {
        const { validators, skipped } = parseValidatorsResponse({
            validators: [{ operator_address: "b52valoper1", status: "BOND_STATUS_BONDED", description: { moniker: "texashodl" } }]
        });
        expect(validators).toEqual([{ moniker: "texashodl", operatorAddress: "b52valoper1", status: "BOND_STATUS_BONDED" }]);
        expect(skipped).toBe(0);
    });

    it("counts malformed entries instead of inventing empty fields", () => {
        const { validators, skipped } = parseValidatorsResponse({
            validators: [{ operator_address: "x", status: "s" }, { description: { moniker: "m" }, status: "s" }, null]
        });
        expect(validators).toEqual([]);
        expect(skipped).toBe(3);
    });

    it("throws when the response has no validators list", () => {
        expect(() => parseValidatorsResponse({})).toThrow(/validators/);
        expect(() => parseValidatorsResponse("oops")).toThrow(/validators/);
    });
});

describe("parseLatestBlockHeight", () => {
    it("reads block.header.height or sdk_block.header.height", () => {
        expect(parseLatestBlockHeight({ block: { header: { height: "42" } } })).toBe("42");
        expect(parseLatestBlockHeight({ sdk_block: { header: { height: "7" } } })).toBe("7");
    });

    it("returns null when no height is reported", () => {
        expect(parseLatestBlockHeight({})).toBeNull();
        expect(parseLatestBlockHeight({ block: { header: {} } })).toBeNull();
        expect(parseLatestBlockHeight(null)).toBeNull();
    });
});
