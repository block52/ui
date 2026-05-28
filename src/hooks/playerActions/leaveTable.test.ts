import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { leaveTable } from "./leaveTable";

jest.mock("../../utils/cosmos/client");

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

describe("leaveTable", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;

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
        const chainError = new Error("game not found");
        mockGetSigningClient.mockResolvedValue({
            signingClient: { leaveGame: jest.fn().mockRejectedValue(chainError) } as unknown as SigningClient,
            userAddress: "b52test"
        });

        await expect(leaveTable("game-xyz", fakeNetwork)).rejects.toThrow("game not found");
    });
});
