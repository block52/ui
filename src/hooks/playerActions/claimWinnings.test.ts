import { getSigningClient, withMoneyMoverRetry } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { claimWinnings } from "./claimWinnings";

// withMoneyMoverRetry gets a passthrough implementation (resolve the mocked
// signing client, run the callback) so these tests exercise claimWinnings'
// settle without the real retry/backoff internals (see client.test.ts).
jest.mock("../../utils/cosmos/client", () => ({
    getSigningClient: jest.fn(),
    withMoneyMoverRetry: jest.fn()
}));
jest.mock("./transportAction");

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;
const mockWithMoneyMoverRetry = withMoneyMoverRetry as jest.MockedFunction<typeof withMoneyMoverRetry>;
const mockGetLatestGameState = getLatestGameState as jest.MockedFunction<typeof getLatestGameState>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

describe("claimWinnings", () => {
    const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;
    const fakeState = { handNumber: 5, deck: "X", results: [{ place: 1, playerId: "b52win", payout: "100" }] };

    const wire = (recordHandEnd: jest.Mock, leaveGame: jest.Mock) =>
        mockGetSigningClient.mockResolvedValue({
            signingClient: { recordHandEnd, leaveGame } as unknown as SigningClient,
            userAddress: "b52test"
        });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetLatestGameState.mockReturnValue(fakeState as ReturnType<typeof getLatestGameState>);
        // Passthrough: resolve the (mocked) signing client and run the callback,
        // matching withMoneyMoverRetry's happy-path behavior.
        mockWithMoneyMoverRetry.mockImplementation(async (network, fn) => fn(await mockGetSigningClient(network)));
    });

    it("settles the prize with the place-1-first finishingOrder", async () => {
        const recordHandEnd = jest.fn();
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        const result = await claimWinnings("game-1", fakeNetwork);

        expect(leaveGame).toHaveBeenCalledWith("game-1", ["b52win"]);
        expect(result).toEqual({ hash: "0xleave", gameId: "game-1" });
    });

    // ui#869: the local state is the masked client view; pushing it overwrote
    // the chain's state and bricked the table for the players still in.
    it("never pushes the local state to the chain", async () => {
        const recordHandEnd = jest.fn().mockResolvedValue("0xrec");
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        await claimWinnings("game-1", fakeNetwork);

        expect(recordHandEnd).not.toHaveBeenCalled();
    });

    it("settles with an empty finishingOrder when there is no local state", async () => {
        mockGetLatestGameState.mockReturnValue(undefined);
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(jest.fn(), leaveGame);

        const result = await claimWinnings("game-1", fakeNetwork);

        expect(leaveGame).toHaveBeenCalledWith("game-1", []);
        expect(result.hash).toBe("0xleave");
    });

    it("surfaces a rejected settle", async () => {
        wire(jest.fn(), jest.fn().mockRejectedValue(new Error("player b52test already claimed payout")));

        await expect(claimWinnings("game-1", fakeNetwork)).rejects.toThrow(/already claimed/);
    });
});
