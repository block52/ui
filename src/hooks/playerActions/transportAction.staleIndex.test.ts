import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { executeGatewayAction, executeTransportAction, setLatestGameState } from "./transportAction";
import { getSigningClient } from "../../utils/cosmos/client";
import { signActionMessage } from "../../utils/cosmos/signing";
import { signSettlementTx } from "../../utils/cosmos/settlementTx";
import { getGameTransport, getGatewayApi } from "../../utils/gameTransport";
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
const mockGetGameTransport = getGameTransport as jest.MockedFunction<typeof getGameTransport>;

type SigningClient = Awaited<ReturnType<typeof getSigningClient>>["signingClient"];

// ui#530: when another player acts mid-hand (a join/sit-in consumes indices) our
// action index goes stale and the engine rejects it with "Invalid action index."
// We do NOT auto-retry; we surface a clear, retryable prompt so the user
// re-submits (which recomputes the index from the state that has since advanced).
describe("executeTransportAction stale-index handling (ui#530)", () => {
    const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;
    const submitAction = jest.fn();
    const ADDRESS = "b52me";

    const stateAtIndex = (index: number): TexasHoldemStateDTO =>
        ({ players: [{ address: ADDRESS, legalActions: [{ action: "check", index }] }] } as unknown as TexasHoldemStateDTO);

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, ADDRESS);
        mockGetGameTransport.mockReturnValue("gateway");
        mockSignActionMessage.mockResolvedValue("eip191-sig");
        mockSignSettlementTx.mockResolvedValue(undefined);
        mockGetSigningClient.mockResolvedValue({ signingClient: {} as unknown as SigningClient, userAddress: ADDRESS });
        mockGetGatewayApi.mockReturnValue({ submitAction } as unknown as ReturnType<typeof getGatewayApi>);
        setLatestGameState(stateAtIndex(7));
    });

    afterEach(() => localStorage.clear());

    it("rewrites a stale-index rejection into a clear, retryable message (no auto-retry)", async () => {
        submitAction.mockResolvedValue({ type: "error", error: "pvm rejected action: Operation failed: Invalid action index." });

        await expect(executeTransportAction("game-1", "check", 0n, fakeNetwork)).rejects.toThrow(/please try again/i);
        expect(submitAction).toHaveBeenCalledTimes(1); // surfaced, not retried
    });

    it("submits with the index from the freshest snapshot", async () => {
        submitAction.mockResolvedValue({ type: "ack" });

        await executeTransportAction("game-1", "check", 0n, fakeNetwork);

        expect(submitAction).toHaveBeenCalledWith(expect.objectContaining({ index: 7 }));
    });

    it("passes non-index rejections through unchanged", async () => {
        submitAction.mockResolvedValue({ type: "error", error: "It is not your turn to act" });

        await expect(executeTransportAction("game-1", "check", 0n, fakeNetwork)).rejects.toThrow(/not your turn/i);
    });

    // Pre-submit freshness check: signing is async, so another player can advance
    // the index while we sign. Catch that BEFORE the POST, not after a reject.
    describe("executeGatewayAction pre-submit freshness check", () => {
        const stateWithLastIndex = (index: number): TexasHoldemStateDTO =>
            ({ previousActions: [{ index }], players: [{ address: ADDRESS }] } as unknown as TexasHoldemStateDTO);

        it("bails (retryable) without submitting when the index advanced during signing", async () => {
            // Another player's action lands while we sign, bumping the next index.
            mockSignActionMessage.mockImplementation(async () => {
                setLatestGameState(stateWithLastIndex(7)); // nextActionIndex -> 8
                return "eip191-sig";
            });

            await expect(executeGatewayAction("game-1", "check", 5, 0n, "", fakeNetwork)).rejects.toThrow(/please try again/i);
            expect(submitAction).not.toHaveBeenCalled();
        });

        it("submits when our index is still current at submit time", async () => {
            setLatestGameState(stateWithLastIndex(4)); // nextActionIndex -> 5
            submitAction.mockResolvedValue({ type: "ack" });

            await executeGatewayAction("game-1", "check", 5, 0n, "", fakeNetwork);
            expect(submitAction).toHaveBeenCalledTimes(1);
        });
    });
});
