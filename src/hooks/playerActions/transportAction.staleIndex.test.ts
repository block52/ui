import { getSigningClient, clearSigningClientCache } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { executeTransportAction } from "./transportAction";

jest.mock("../../utils/cosmos/client", () => ({
    getSigningClient: jest.fn(),
    clearSigningClientCache: jest.fn()
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

// Gameplay actions are UNORDERED from SDK 1.4.1 (poker-vm#2619): they carry no
// account sequence, so there is nothing to recover from. The wait-and-retry that
// lived here re-read the same stale sequence and failed identically (ui#635).
describe("executeTransportAction — no account-sequence recovery", () => {
    beforeEach(() => jest.clearAllMocks());

    const SEQ_ERR = new Error(
        "Broadcasting transaction failed with code 32 (codespace: sdk). Log: account sequence mismatch, expected 510, got 509: incorrect account sequence"
    );

    it("surfaces a sequence mismatch without retrying — it means an ordered SDK build is in play", async () => {
        const performActionSync = jest.fn().mockRejectedValue(SEQ_ERR);
        mockSigningClient(performActionSync);

        await expect(executeTransportAction("game-1", "sit-out", 0n, fakeNetwork, "method=next-hand")).rejects.toThrow(
            /account sequence mismatch/
        );
        expect(performActionSync).toHaveBeenCalledTimes(1);
        expect(mockClearSigningClientCache).not.toHaveBeenCalled();
    });

    it("broadcasts exactly once for any other error", async () => {
        const performActionSync = jest.fn().mockRejectedValue(new Error("insufficient funds"));
        mockSigningClient(performActionSync);

        await expect(executeTransportAction("game-1", "sit-out", 0n, fakeNetwork)).rejects.toThrow("insufficient funds");
        expect(performActionSync).toHaveBeenCalledTimes(1);
    });
});
