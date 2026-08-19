import { getSigningClient, withMoneyMoverRetry } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { claimWinnings } from "./claimWinnings";

// withMoneyMoverRetry gets a passthrough implementation (resolve the mocked
// signing client, run the callback) so these tests exercise claimWinnings'
// record→settle flow without the real retry/backoff internals (see client.test.ts).
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
    const fakeState = { handNumber: 5, results: [{ place: 1, playerId: "b52win", payout: "100" }] };

    const wire = (recordHandEnd: jest.Mock, leaveGame: jest.Mock) =>
        mockGetSigningClient.mockResolvedValue({
            signingClient: { recordHandEnd, leaveGame } as unknown as SigningClient,
            userAddress: "b52test"
        });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "warn").mockImplementation(() => {});
        mockGetLatestGameState.mockReturnValue(fakeState as ReturnType<typeof getLatestGameState>);
        // Passthrough: resolve the (mocked) signing client and run the callback,
        // matching withMoneyMoverRetry's happy-path behavior.
        mockWithMoneyMoverRetry.mockImplementation(async (network, fn) => fn(await mockGetSigningClient(network)));
    });

    afterEach(() => {
        (console.warn as jest.Mock).mockRestore?.();
    });

    it("records the hand-end, then settles the prize", async () => {
        const recordHandEnd = jest.fn().mockResolvedValue("0xrec");
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        const result = await claimWinnings("game-1", fakeNetwork);

        expect(recordHandEnd).toHaveBeenCalledWith("game-1", JSON.stringify(fakeState));
        // Settles with the place-1-first finishingOrder derived from results[].
        expect(leaveGame).toHaveBeenCalledWith("game-1", ["b52win"]);
        expect(result).toEqual({ hash: "0xleave", gameId: "game-1" });
    });

    it("skips recordHandEnd when there is no local state, still settles", async () => {
        mockGetLatestGameState.mockReturnValue(undefined);
        const recordHandEnd = jest.fn();
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        const result = await claimWinnings("game-1", fakeNetwork);

        expect(recordHandEnd).not.toHaveBeenCalled();
        // No local state → empty finishingOrder (chain settles from its own state).
        expect(leaveGame).toHaveBeenCalledWith("game-1", []);
        expect(result.hash).toBe("0xleave");
    });

    // Benign: another finisher already recorded the results (ErrStaleHandEnd).
    // The results are on-chain — proceed to settle.
    it.each([
        ["already finalized", "game abc is already finalized"],
        ["stale", "broadcast failed (code 1118): hand-end push is stale or the game is already finalized"]
    ])("proceeds to settle when recordHandEnd is rejected as %s", async (_label, message) => {
        const recordHandEnd = jest.fn().mockRejectedValue(new Error(message));
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        const result = await claimWinnings("game-1", fakeNetwork);

        expect(leaveGame).toHaveBeenCalledWith("game-1", ["b52win"]);
        expect(result.hash).toBe("0xleave");
    });

    // Fatal: results are NOT on-chain. Surface the error and DO NOT settle
    // (settling would silently pay nothing). Regression guard for ui#503.
    it("surfaces a non-benign recordHandEnd failure and does not settle", async () => {
        const recordHandEnd = jest.fn().mockRejectedValue(new Error("account b52test not found on chain"));
        const leaveGame = jest.fn().mockResolvedValue("0xleave");
        wire(recordHandEnd, leaveGame);

        await expect(claimWinnings("game-1", fakeNetwork)).rejects.toThrow(/Could not record the finished hand on-chain/);
        expect(leaveGame).not.toHaveBeenCalled();
    });
});
