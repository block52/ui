import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { getSigningClient, withMoneyMoverRetry } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { leaveTable } from "./leaveTable";

// Mock the client module. withMoneyMoverRetry gets a passthrough implementation
// that resolves the (mocked) signing client and runs the callback — so these
// tests exercise leaveTable's happy path + error propagation without depending
// on the real retry/backoff internals (covered in client.test.ts).
jest.mock("../../utils/cosmos/client", () => ({
    getSigningClient: jest.fn(),
    withMoneyMoverRetry: jest.fn()
}));

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;
const mockWithMoneyMoverRetry = withMoneyMoverRetry as jest.MockedFunction<typeof withMoneyMoverRetry>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

describe("leaveTable", () => {
    const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;

    beforeEach(() => {
        jest.clearAllMocks();
        // Passthrough: resolve the (mocked) signing client and run the callback,
        // matching withMoneyMoverRetry's happy-path behavior.
        mockWithMoneyMoverRetry.mockImplementation(async (network, fn) => fn(await mockGetSigningClient(network)));
    });

    it("broadcasts MsgLeaveGame via signingClient.leaveGame with the tableId only", async () => {
        const leaveGame = jest.fn().mockResolvedValue("0xdeadbeef");
        mockGetSigningClient.mockResolvedValue({
            signingClient: { leaveGame } as unknown as SigningClient,
            userAddress: "b52test"
        });

        const result = await leaveTable("game-abc", fakeNetwork);

        expect(leaveGame).toHaveBeenCalledTimes(1);
        expect(leaveGame).toHaveBeenCalledWith("game-abc");
        expect(result).toEqual({
            hash: "0xdeadbeef",
            gameId: "game-abc",
            action: NonPlayerActionType.LEAVE
        });
    });

    it("propagates chain errors so the modal can surface them inline", async () => {
        mockGetSigningClient.mockResolvedValue({
            signingClient: { leaveGame: jest.fn().mockRejectedValue(new Error("game not found")) } as unknown as SigningClient,
            userAddress: "b52test"
        });

        await expect(leaveTable("game-xyz", fakeNetwork)).rejects.toThrow("game not found");
    });
});
