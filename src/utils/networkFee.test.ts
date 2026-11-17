import { DEFAULT_NETWORK_FEE_MICRO } from "./buyInUtils";
import { NETWORK_FEE_CACHE_MS, clearNetworkFeeCache, getNetworkFeePerEntryCached, readNetworkFeePerEntry } from "./networkFee";

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
    clearNetworkFeeCache();
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
});

describe("readNetworkFeePerEntry", () => {
    it("returns the chain's fee", async () => {
        await expect(readNetworkFeePerEntry({ getNetworkFeePerEntry: async () => 250_000n })).resolves.toEqual({ feeMicro: 250_000n, source: "chain" });
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it("returns a governance fee of 0 as 0, not the default", async () => {
        await expect(readNetworkFeePerEntry({ getNetworkFeePerEntry: async () => 0n })).resolves.toEqual({ feeMicro: 0n, source: "chain" });
    });

    it("falls back to 0.10 and logs when the query fails", async () => {
        const reading = await readNetworkFeePerEntry({ getNetworkFeePerEntry: async () => { throw new Error("503"); } });
        expect(reading).toEqual({ feeMicro: DEFAULT_NETWORK_FEE_MICRO, source: "fallback" });
        expect(error).toHaveBeenCalledTimes(1);
    });

    it("falls back to 0.10 and logs on an SDK without getNetworkFeePerEntry", async () => {
        await expect(readNetworkFeePerEntry({})).resolves.toEqual({ feeMicro: 100_000n, source: "fallback" });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("getNetworkFeePerEntry"));
    });

    it("falls back to 0.10 and logs with no client", async () => {
        await expect(readNetworkFeePerEntry(null)).resolves.toEqual({ feeMicro: 100_000n, source: "fallback" });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("falls back on an invalid value", async () => {
        await expect(readNetworkFeePerEntry({ getNetworkFeePerEntry: async () => -1n })).resolves.toEqual({ feeMicro: 100_000n, source: "fallback" });
        expect(error).toHaveBeenCalledTimes(1);
    });
});

describe("getNetworkFeePerEntryCached", () => {
    it("reads the chain once per endpoint and shares the answer", async () => {
        const getNetworkFeePerEntry = jest.fn(async () => 250_000n);
        const getClient = jest.fn(() => ({ getNetworkFeePerEntry }));
        const [a, b] = await Promise.all([
            getNetworkFeePerEntryCached("https://rest-a", getClient, 0),
            getNetworkFeePerEntryCached("https://rest-a", getClient, 10)
        ]);
        expect(a.feeMicro).toBe(250_000n);
        expect(b.feeMicro).toBe(250_000n);
        expect(getNetworkFeePerEntry).toHaveBeenCalledTimes(1);

        await getNetworkFeePerEntryCached("https://rest-b", getClient, 20);
        expect(getNetworkFeePerEntry).toHaveBeenCalledTimes(2);
    });

    it("reads again once the cached value is stale", async () => {
        const getNetworkFeePerEntry = jest.fn(async () => 250_000n);
        await getNetworkFeePerEntryCached("k", () => ({ getNetworkFeePerEntry }), 0);
        await getNetworkFeePerEntryCached("k", () => ({ getNetworkFeePerEntry }), NETWORK_FEE_CACHE_MS - 1);
        expect(getNetworkFeePerEntry).toHaveBeenCalledTimes(1);
        await getNetworkFeePerEntryCached("k", () => ({ getNetworkFeePerEntry }), NETWORK_FEE_CACHE_MS);
        expect(getNetworkFeePerEntry).toHaveBeenCalledTimes(2);
    });

    it("does not keep a fallback, so the next caller retries", async () => {
        const getNetworkFeePerEntry = jest.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(300_000n);
        await expect(getNetworkFeePerEntryCached("k", () => ({ getNetworkFeePerEntry }), 0)).resolves.toEqual({ feeMicro: 100_000n, source: "fallback" });
        await expect(getNetworkFeePerEntryCached("k", () => ({ getNetworkFeePerEntry }), 1)).resolves.toEqual({ feeMicro: 300_000n, source: "chain" });
    });

    it("falls back when creating the client throws", async () => {
        const reading = await getNetworkFeePerEntryCached("k", () => { throw new Error("bad config"); }, 0);
        expect(reading).toEqual({ feeMicro: 100_000n, source: "fallback" });
        expect(error).toHaveBeenCalled();
    });
});
