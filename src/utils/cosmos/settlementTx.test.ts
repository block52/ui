import { NonPlayerActionType, PlayerActionType } from "@block52/poker-vm-sdk";
import type { SigningCosmosClient } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { finishingOrderFromState, signSettlementTx } from "./settlementTx";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { getCosmosUrls } from "./client";

jest.mock("./client", () => ({
    getCosmosUrls: jest.fn(() => ({ restEndpoint: "http://rest" }))
}));

const fakeNetwork = {} as NetworkEndpoints;
const ADDR = "b52test";

// signSettlementTx queries the account sequence once via fetch; stub a funded
// account so signing proceeds.
function stubFundedAccount(): void {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ account: { account_number: "5", sequence: "9" } })
    }) as unknown as typeof fetch;
}

function makeClient() {
    return {
        signJoinGame: jest.fn().mockResolvedValue({ base64: "JOIN_TX" }),
        signLeaveGame: jest.fn().mockResolvedValue({ base64: "LEAVE_TX" }),
        signTopUp: jest.fn().mockResolvedValue({ base64: "TOPUP_TX" }),
        signPerformAction: jest.fn().mockResolvedValue({ base64: "PERFORM_TX" })
    };
}

describe("signSettlementTx — money-mover dispatch (#2325)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        stubFundedAccount();
        (getCosmosUrls as jest.Mock).mockReturnValue({ restEndpoint: "http://rest" });
    });

    it("signs MsgJoinGame for JOIN, with the seat parsed from data", async () => {
        const client = makeClient();
        const tx = await signSettlementTx(client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", NonPlayerActionType.JOIN, 1000n, "seat=4");

        expect(tx).toBe("JOIN_TX");
        expect(client.signJoinGame).toHaveBeenCalledWith("game-1", 4, 1000n, expect.objectContaining({ accountNumber: 5, sequence: 9 }));
        expect(client.signPerformAction).not.toHaveBeenCalled();
    });

    it("signs MsgLeaveGame for LEAVE with an empty finishing order by default", async () => {
        const client = makeClient();
        const tx = await signSettlementTx(client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", NonPlayerActionType.LEAVE, 0n, "");

        expect(tx).toBe("LEAVE_TX");
        expect(client.signLeaveGame).toHaveBeenCalledWith("game-1", expect.any(Object), []);
        expect(client.signPerformAction).not.toHaveBeenCalled();
    });

    it("passes the finishing order through to signLeaveGame for a finished SNG leave", async () => {
        const client = makeClient();
        const order = ["b52winner", "b52second", "b52third"];
        const tx = await signSettlementTx(
            client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", NonPlayerActionType.LEAVE, 0n, "", order
        );

        expect(tx).toBe("LEAVE_TX");
        expect(client.signLeaveGame).toHaveBeenCalledWith("game-1", expect.any(Object), order);
    });

    it("signs MsgTopUp for TOP_UP", async () => {
        const client = makeClient();
        const tx = await signSettlementTx(client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", NonPlayerActionType.TOP_UP, 500n, "");

        expect(tx).toBe("TOPUP_TX");
        expect(client.signTopUp).toHaveBeenCalledWith("game-1", 500n, expect.any(Object));
        expect(client.signPerformAction).not.toHaveBeenCalled();
    });

    it("uses MsgPerformAction for gameplay actions, signed UNORDERED (no signerData, #247)", async () => {
        const client = makeClient();
        const tx = await signSettlementTx(client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", PlayerActionType.BET, 50n, "");

        expect(tx).toBe("PERFORM_TX");
        // Gameplay is unordered — signPerformAction is called with NO signerData.
        expect(client.signPerformAction).toHaveBeenCalledWith("game-1", PlayerActionType.BET, 50n, "");
        expect(client.signJoinGame).not.toHaveBeenCalled();
    });

    it("throws when a JOIN has no seat in data", async () => {
        const client = makeClient();
        // signSettlementTx swallows sign errors and returns undefined (graceful
        // degradation), so a missing seat surfaces as no settlement tx.
        const tx = await signSettlementTx(client as unknown as SigningCosmosClient, ADDR, fakeNetwork, "game-1", NonPlayerActionType.JOIN, 1000n, "");
        expect(tx).toBeUndefined();
        expect(client.signJoinGame).not.toHaveBeenCalled();
    });
});

describe("finishingOrderFromState (pokerchain#229)", () => {
    it("returns [] when the game has no results (not finalized)", () => {
        expect(finishingOrderFromState(undefined)).toEqual([]);
        expect(finishingOrderFromState({ results: [] } as unknown as TexasHoldemStateDTO)).toEqual([]);
    });

    it("returns addresses in place-1-first order regardless of results[] order", () => {
        const state = {
            results: [
                { place: 3, playerId: "b52third", payout: "0" },
                { place: 1, playerId: "b52winner", payout: "300" },
                { place: 2, playerId: "b52second", payout: "0" }
            ]
        } as unknown as TexasHoldemStateDTO;
        expect(finishingOrderFromState(state)).toEqual(["b52winner", "b52second", "b52third"]);
    });
});
