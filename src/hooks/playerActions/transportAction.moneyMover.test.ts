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

// The unfunded-buy-in gate lives on the join button (a BALANCE check in
// VacantPlayer/BuyInModal) and — authoritatively — in the gateway, which rejects
// a money-mover relayed with no settlement tx (#2433). executeGatewayAction must
// NOT itself block on a missing tx: a missing tx also means "no on-chain account
// yet" (dev / stub / fresh-but-funded), a legitimate optimistic join. These tests
// pin that contract so we don't regress back to a client-side throw that broke
// the stub e2e.
describe("executeGatewayAction money-mover relay (#2433)", () => {
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

    it("relays a JOIN with the escrow tx attached when it could be signed", async () => {
        mockSignSettlementTx.mockResolvedValue("base64-tx");

        await executeGatewayAction("game-1", NonPlayerActionType.JOIN, 1, 1000000n, "seat=1", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ tx: "base64-tx", action: NonPlayerActionType.JOIN }));
    });

    it("still submits a JOIN with no tx (no on-chain account yet — the button balance-gate is the funds guard)", async () => {
        mockSignSettlementTx.mockResolvedValue(undefined);

        await executeGatewayAction("game-1", NonPlayerActionType.JOIN, 1, 1000000n, "seat=1", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ tx: undefined, action: NonPlayerActionType.JOIN }));
    });

    it("submits gameplay actions without a settlement tx (optimistic play)", async () => {
        mockSignSettlementTx.mockResolvedValue(undefined);

        await executeGatewayAction("game-1", "call", 3, 1000000n, "", fakeNetwork);

        expect(submitAction).toHaveBeenCalledTimes(1);
        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ tx: undefined, action: "call" }));
    });
});
