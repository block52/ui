import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { executeGatewayAction } from "./transportAction";
import { getSigningClient } from "../../utils/cosmos/client";
import { signActionMessage } from "../../utils/cosmos/signing";
import { signSettlementTx } from "../../utils/cosmos/settlementTx";
import { getGatewayApi } from "../../utils/gameTransport";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { NetworkEndpoints } from "../../context/NetworkContext";

jest.mock("../../utils/cosmos/client");
jest.mock("../../utils/cosmos/signing");
jest.mock("../../utils/cosmos/settlementTx");
jest.mock("../../utils/gameTransport");

const mockGetSigningClient = getSigningClient as jest.MockedFunction<typeof getSigningClient>;
const mockSignActionMessage = signActionMessage as jest.MockedFunction<typeof signActionMessage>;
const mockSignSettlementTx = signSettlementTx as jest.MockedFunction<typeof signSettlementTx>;
const mockGetGatewayApi = getGatewayApi as jest.MockedFunction<typeof getGatewayApi>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

// Money-IN movers (join / top-up) MUST relay their escrow tx. When the account
// isn't funded, signSettlementTx returns undefined — the gateway must NOT be
// asked to apply the action, or the player is seated for free (#2433).
describe("executeGatewayAction money-mover guard (#2433)", () => {
    const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;
    const submitAction = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, "b52test");
        mockSignActionMessage.mockResolvedValue("eip191-sig");
        mockGetSigningClient.mockResolvedValue({
            signingClient: {} as unknown as SigningClient,
            userAddress: "b52test"
        });
        mockGetGatewayApi.mockReturnValue({ submitAction } as unknown as ReturnType<typeof getGatewayApi>);
        submitAction.mockResolvedValue({ type: "ack" });
    });

    afterEach(() => localStorage.clear());

    it.each([NonPlayerActionType.JOIN, NonPlayerActionType.TOP_UP])(
        "throws for %s when the escrow tx can't be signed (unfunded)",
        async action => {
            mockSignSettlementTx.mockResolvedValue(undefined);

            await expect(
                executeGatewayAction("game-1", action, 1, 1000000n, "seat=1", fakeNetwork)
            ).rejects.toThrow(/insufficient funds/i);

            expect(submitAction).not.toHaveBeenCalled();
        }
    );

    it("submits a JOIN once the escrow tx is present", async () => {
        mockSignSettlementTx.mockResolvedValue("base64-tx");

        await executeGatewayAction("game-1", NonPlayerActionType.JOIN, 1, 1000000n, "seat=1", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ tx: "base64-tx", action: NonPlayerActionType.JOIN }));
    });

    it("still submits gameplay actions without a settlement tx (optimistic play)", async () => {
        mockSignSettlementTx.mockResolvedValue(undefined);

        await executeGatewayAction("game-1", "call", 3, 1000000n, "", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ tx: undefined, action: "call" }));
    });

    it("does not hard-block LEAVE without a settlement tx (money-out, never strands a player)", async () => {
        mockSignSettlementTx.mockResolvedValue(undefined);

        await executeGatewayAction("game-1", NonPlayerActionType.LEAVE, 5, 0n, "", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
    });
});
