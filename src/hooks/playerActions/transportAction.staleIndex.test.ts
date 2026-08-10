import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { executeTransportAction } from "./transportAction";

jest.mock("../../utils/cosmos/client");

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;

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
