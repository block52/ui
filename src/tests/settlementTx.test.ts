import { signSettlementTx } from "../utils/cosmos/settlementTx";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";

// getCosmosUrls is used to derive the REST endpoint.
jest.mock("../utils/cosmos/client", () => ({
    getCosmosUrls: () => ({ rpcEndpoint: "http://rpc", restEndpoint: "http://rest" })
}));

const network = {} as NetworkEndpoints;

function mockSigningClient(base64 = "dHhyYXc=") {
    return {
        // gameplay path
        signPerformAction: jest.fn().mockResolvedValue({ base64, sequence: 0, accountNumber: 1 }),
        // money-mover paths
        signJoinGame: jest.fn().mockResolvedValue({ base64, sequence: 3, accountNumber: 7 }),
        signLeaveGame: jest.fn().mockResolvedValue({ base64 }),
        signTopUp: jest.fn().mockResolvedValue({ base64 })
    } as any;
}

describe("signSettlementTx", () => {
    const ADDR = "b52funded";

    beforeEach(() => jest.restoreAllMocks());

    it("gameplay signs UNORDERED — no account query, no sequence (#247)", async () => {
        global.fetch = jest.fn() as any; // must NOT be called for gameplay
        const client = mockSigningClient();

        const tx1 = await signSettlementTx(client, ADDR, network, "g1", "call", 100n, "");
        const tx2 = await signSettlementTx(client, ADDR, network, "g1", "check", 0n, "");

        expect(tx1).toBe("dHhyYXc=");
        expect(tx2).toBe("dHhyYXc=");
        // No account query — unordered txs carry no sequence.
        expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
        // signPerformAction called WITHOUT signerData (unordered).
        expect(client.signPerformAction).toHaveBeenNthCalledWith(1, "g1", "call", 100n, "");
        expect(client.signPerformAction).toHaveBeenNthCalledWith(2, "g1", "check", 0n, "");
    });

    it("gameplay settles even for an unfunded account (unordered needs no account)", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
        const client = mockSigningClient();

        const tx = await signSettlementTx(client, "b52unfunded", network, "g1", "call", 100n, "");
        expect(tx).toBe("dHhyYXc=");
        expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
    });

    it("money-movers stay ORDERED — fetch the live sequence and pass it through", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ account: { account_number: "7", sequence: "3" } })
        }) as any;
        const client = mockSigningClient();

        const tx = await signSettlementTx(client, ADDR, network, "g1", NonPlayerActionType.JOIN, 1000n, "seat=2");

        expect(tx).toBe("dHhyYXc=");
        expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(1);
        expect(client.signJoinGame).toHaveBeenCalledWith(
            "g1", 2, 1000n,
            expect.objectContaining({ accountNumber: 7, sequence: 3 })
        );
    });

    it("money-mover on an unfunded account → no settlement", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
        const client = mockSigningClient();

        const tx = await signSettlementTx(client, "b52unfunded", network, "g1", NonPlayerActionType.TOP_UP, 500n, "");
        expect(tx).toBeUndefined();
        expect(client.signTopUp).not.toHaveBeenCalled();
    });

    it("returns undefined on a sign error (gameplay proceeds without settlement)", async () => {
        const client = {
            signPerformAction: jest.fn().mockRejectedValueOnce(new Error("sign boom"))
        } as any;

        const tx = await signSettlementTx(client, ADDR, network, "g1", "raise", 200n, "");
        expect(tx).toBeUndefined();
    });
});
