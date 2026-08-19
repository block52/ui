/**
 * Tests for the promise-memoized signing client.
 *
 * The whole point of caching is to dedupe an expensive PBKDF2 derivation
 * across actions in a single session. Without a test that pins the dedup
 * behaviour, the cache can silently regress (e.g. the cache key drifts
 * out of sync with the inputs, or someone refactors away the cache hit).
 */

import type { NetworkEndpoints } from "./urls";

// Mock the SDK so we can count derivations without doing real BIP39 work.
const mockCreateSigningClientFromMnemonic = jest.fn();

jest.mock("@block52/poker-vm-sdk", () => ({
    CosmosClient: jest.fn(),
    SigningCosmosClient: jest.fn(),
    createSigningClientFromMnemonic: (...args: unknown[]) => mockCreateSigningClientFromMnemonic(...args),
    getDefaultCosmosConfig: () => ({
        chainId: "test-chain",
        prefix: "b52",
        denom: "stake",
        gasPrice: "0stake"
    }),
    COSMOS_CONSTANTS: {
        CHAIN_ID: "test-chain",
        ADDRESS_PREFIX: "b52"
    }
}));

// Mock storage so we don't need a real localStorage.
const mockAddress = jest.fn<string | null, []>();
const mockMnemonic = jest.fn<string | null, []>();
jest.mock("./storage", () => ({
    getCosmosAddress: () => mockAddress(),
    getCosmosMnemonic: () => mockMnemonic()
}));

import { getSigningClient, clearSigningClientCache, withSigningClientRetry, withMoneyMoverRetry, isSequenceMismatchError } from "./client";

const NETWORK_A: NetworkEndpoints = {
    name: "A",
    rpc: "https://node-a.example/rpc/",
    rest: "https://node-a.example",
    grpc: "grpcs://node-a.example:9443",
    ws: "wss://node-a.example/ws"
};

const NETWORK_B: NetworkEndpoints = {
    name: "B",
    rpc: "https://node-b.example/rpc/",
    rest: "https://node-b.example",
    grpc: "grpcs://node-b.example:9443",
    ws: "wss://node-b.example/ws"
};

const MNEMONIC = "test test test test test test test test test test test junk";
const ADDRESS_1 = "b521aaaa";
const ADDRESS_2 = "b521bbbb";

describe("getSigningClient", () => {
    beforeEach(() => {
        clearSigningClientCache();
        mockCreateSigningClientFromMnemonic.mockReset();
        mockAddress.mockReturnValue(ADDRESS_1);
        mockMnemonic.mockReturnValue(MNEMONIC);

        // Default: each derivation returns a fresh fake client.
        mockCreateSigningClientFromMnemonic.mockImplementation(async () => ({
            performActionSync: jest.fn(),
            disconnect: jest.fn()
        }));
    });

    it("derives the signing client only once across repeated calls in the same session", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("dedupes concurrent callers into a single in-flight derivation", async () => {
        // Slow derivation so both calls land while the first is still pending.
        let resolveDerivation!: (client: unknown) => void;
        mockCreateSigningClientFromMnemonic.mockImplementationOnce(
            () => new Promise(resolve => { resolveDerivation = resolve; })
        );

        const first = getSigningClient(NETWORK_A);
        const second = getSigningClient(NETWORK_A);

        resolveDerivation({ performActionSync: jest.fn() });
        const [a, b] = await Promise.all([first, second]);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
        expect(a.signingClient).toBe(b.signingClient);
    });

    it("rebuilds when the network endpoints change", async () => {
        await getSigningClient(NETWORK_A);
        await getSigningClient(NETWORK_B);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds when the wallet address changes (wallet swap)", async () => {
        mockAddress.mockReturnValue(ADDRESS_1);
        await getSigningClient(NETWORK_A);

        mockAddress.mockReturnValue(ADDRESS_2);
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("rebuilds after clearSigningClientCache()", async () => {
        await getSigningClient(NETWORK_A);
        clearSigningClientCache();
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("drops the cache when derivation rejects so the next call retries", async () => {
        mockCreateSigningClientFromMnemonic.mockRejectedValueOnce(new Error("boom"));

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow("boom");

        // Allow the rejection-handler microtask to run.
        await Promise.resolve();

        // Second call should build a fresh promise rather than returning the rejected one.
        mockCreateSigningClientFromMnemonic.mockResolvedValueOnce({ performActionSync: jest.fn() });
        await getSigningClient(NETWORK_A);

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });

    it("throws if the wallet is not initialized", async () => {
        mockMnemonic.mockReturnValue(null);

        await expect(getSigningClient(NETWORK_A)).rejects.toThrow(/wallet not initialized/i);
        expect(mockCreateSigningClientFromMnemonic).not.toHaveBeenCalled();
    });
});

describe("withSigningClientRetry", () => {
    beforeEach(() => {
        clearSigningClientCache();
        mockCreateSigningClientFromMnemonic.mockReset();
        mockAddress.mockReturnValue(ADDRESS_1);
        mockMnemonic.mockReturnValue(MNEMONIC);
        mockCreateSigningClientFromMnemonic.mockImplementation(async () => ({
            performActionSync: jest.fn(),
            disconnect: jest.fn()
        }));
    });

    it("passes through successful results without rebuilding the client", async () => {
        const result = await withSigningClientRetry(NETWORK_A, async ({ signingClient }) => {
            return signingClient ? "ok" : "no-client";
        });

        expect(result).toBe("ok");
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry application errors (e.g. CheckTx rejection)", async () => {
        const appError = new Error("insufficient gas");

        await expect(
            withSigningClientRetry(NETWORK_A, async () => { throw appError; })
        ).rejects.toThrow("insufficient gas");

        // No second client build — we don't want to double-submit a tx the chain rejected.
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("retries once on transport errors with a fresh client", async () => {
        let callCount = 0;
        await withSigningClientRetry(NETWORK_A, async () => {
            callCount++;
            if (callCount === 1) throw new Error("ECONNRESET: socket disconnected");
            return "recovered";
        });

        // First client + rebuilt client = 2 derivations.
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
        expect(callCount).toBe(2);
    });

    it("only retries once even if the rebuilt client also fails with a transport error", async () => {
        const err = new Error("network unreachable");

        await expect(
            withSigningClientRetry(NETWORK_A, async () => { throw err; })
        ).rejects.toThrow("network unreachable");

        // First client + one rebuild attempt = 2 derivations, no more.
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });
});

describe("isSequenceMismatchError", () => {
    it("matches the SDK account-sequence-mismatch broadcast error", () => {
        const err = new Error(
            "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 61, got 60: incorrect account sequence"
        );
        expect(isSequenceMismatchError(err)).toBe(true);
    });

    it("is case-insensitive and works on plain strings", () => {
        expect(isSequenceMismatchError("Account Sequence Mismatch")).toBe(true);
    });

    it("does not match unrelated errors", () => {
        expect(isSequenceMismatchError(new Error("insufficient gas"))).toBe(false);
        expect(isSequenceMismatchError(new Error("Invalid action index"))).toBe(false);
        expect(isSequenceMismatchError(null)).toBe(false);
        expect(isSequenceMismatchError(undefined)).toBe(false);
    });
});

describe("withMoneyMoverRetry", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        clearSigningClientCache();
        mockCreateSigningClientFromMnemonic.mockReset();
        mockAddress.mockReturnValue(ADDRESS_1);
        mockMnemonic.mockReturnValue(MNEMONIC);
        mockCreateSigningClientFromMnemonic.mockImplementation(async () => ({
            joinGame: jest.fn(),
            disconnect: jest.fn()
        }));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("passes through successful results without rebuilding the client", async () => {
        const result = await withMoneyMoverRetry(NETWORK_A, async () => "joined");

        expect(result).toBe("joined");
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("retries once with a fresh client after a sequence mismatch, waiting for the pending tx to commit", async () => {
        let callCount = 0;
        const promise = withMoneyMoverRetry(NETWORK_A, async () => {
            callCount++;
            if (callCount === 1) {
                throw new Error("account sequence mismatch, expected 61, got 60: incorrect account sequence");
            }
            return "recovered";
        });

        // The retry is gated behind the backoff timer — advance it, then let the
        // rebuilt-client microtasks settle.
        await jest.advanceTimersByTimeAsync(2000);

        await expect(promise).resolves.toBe("recovered");
        // First client + rebuilt client (fresh sequence query) = 2 derivations.
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
        expect(callCount).toBe(2);
    });

    it("retries once on transport errors without waiting (no backoff needed)", async () => {
        let callCount = 0;
        const promise = withMoneyMoverRetry(NETWORK_A, async () => {
            callCount++;
            if (callCount === 1) throw new Error("ECONNRESET: socket disconnected");
            return "recovered";
        });

        await expect(promise).resolves.toBe("recovered");
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
        expect(callCount).toBe(2);
    });

    it("does NOT retry unrelated application errors", async () => {
        await expect(
            withMoneyMoverRetry(NETWORK_A, async () => { throw new Error("insufficient funds"); })
        ).rejects.toThrow("insufficient funds");

        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the retry also fails (a persistently wedged sequence)", async () => {
        const promise = withMoneyMoverRetry(NETWORK_A, async () => {
            throw new Error("account sequence mismatch, expected 61, got 60");
        });
        // Attach a rejection handler before advancing timers so the eventual
        // rejection is never momentarily unhandled.
        const assertion = expect(promise).rejects.toThrow(/account sequence mismatch/);
        await jest.advanceTimersByTimeAsync(2000);
        await assertion;

        // First client + one rebuild attempt = 2 derivations, no infinite loop.
        expect(mockCreateSigningClientFromMnemonic).toHaveBeenCalledTimes(2);
    });
});
