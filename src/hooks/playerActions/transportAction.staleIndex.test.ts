import { getSigningClient, clearSigningClientCache } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { executeTransportAction } from "./transportAction";

// Provide a real isSequenceMismatchError so the retry branch can trigger, a zero
// retry delay so tests don't wait, and spies for the client accessors.
jest.mock("../../utils/cosmos/client", () => ({
    getSigningClient: jest.fn(),
    clearSigningClientCache: jest.fn(),
    isSequenceMismatchError: (err: unknown) =>
        /account sequence mismatch/i.test(err instanceof Error ? err.message : String(err ?? "")),
    SEQUENCE_RETRY_DELAY_MS: 0
}));

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;
const mockClearSigningClientCache = clearSigningClientCache as jest.MockedFunction<typeof clearSigningClientCache>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;

function mockSigningClient(performActionSync: jest.Mock): void {
    mockGetSigningClient.mockResolvedValue({
        signingClient: { performActionSync } as unknown as SigningClient,
        userAddress: "b52test"
    });
}

describe("executeTransportAction — stale-index rewrite", () => {
    beforeEach(() => jest.clearAllMocks());

    it("rewrites the chain's raw 'Invalid action index' into the retryable prompt", async () => {
        mockSigningClient(jest.fn().mockRejectedValue(new Error("Invalid action index")));

        await expect(executeTransportAction("game-1", "call", 0n, fakeNetwork)).rejects.toThrow(
            "Your turn advanced while you were acting — please try again."
        );
    });

    it("propagates every other chain error unchanged", async () => {
        mockSigningClient(jest.fn().mockRejectedValue(new Error("insufficient funds")));

        await expect(executeTransportAction("game-1", "call", 0n, fakeNetwork)).rejects.toThrow("insufficient funds");
    });

    it("returns the tx result on success", async () => {
        mockSigningClient(jest.fn().mockResolvedValue("0xabc"));

        const result = await executeTransportAction("game-1", "bet", 100n, fakeNetwork);

        expect(result).toEqual({ hash: "0xabc", gameId: "game-1", action: "bet", amount: "100" });
    });
});

describe("executeTransportAction — sequence-mismatch recovery", () => {
    beforeEach(() => jest.clearAllMocks());

    const SEQ_ERR = new Error(
        "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509: incorrect account sequence"
    );

    it("clears the client cache and retries once, succeeding on the retry", async () => {
        const performActionSync = jest
            .fn()
            .mockRejectedValueOnce(SEQ_ERR)
            .mockResolvedValueOnce("0xretry");
        mockSigningClient(performActionSync);

        const result = await executeTransportAction("game-1", "sit-out", 0n, fakeNetwork, "method=next-hand");

        expect(result).toEqual({ hash: "0xretry", gameId: "game-1", action: "sit-out", amount: "0" });
        expect(performActionSync).toHaveBeenCalledTimes(2);
        expect(mockClearSigningClientCache).toHaveBeenCalledTimes(1);
    });

    it("surfaces the error if the sequence mismatch persists after the retry", async () => {
        const performActionSync = jest.fn().mockRejectedValue(SEQ_ERR);
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, fakeNetwork, "method=next-hand")
        ).rejects.toThrow(/account sequence mismatch/);
        expect(performActionSync).toHaveBeenCalledTimes(2);
    });

    it("does not retry a non-sequence error", async () => {
        const performActionSync = jest.fn().mockRejectedValue(new Error("insufficient funds"));
        mockSigningClient(performActionSync);

        await expect(executeTransportAction("game-1", "sit-out", 0n, fakeNetwork)).rejects.toThrow("insufficient funds");
        expect(performActionSync).toHaveBeenCalledTimes(1);
        expect(mockClearSigningClientCache).not.toHaveBeenCalled();
    });

    it("rewrites a stale-index error surfaced on the retry", async () => {
        const performActionSync = jest
            .fn()
            .mockRejectedValueOnce(SEQ_ERR)
            .mockRejectedValueOnce(new Error("Invalid action index"));
        mockSigningClient(performActionSync);

        await expect(
            executeTransportAction("game-1", "sit-out", 0n, fakeNetwork, "method=next-hand")
        ).rejects.toThrow("Your turn advanced while you were acting — please try again.");
    });
});
