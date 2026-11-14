import type { CreateTournamentParams } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";
import { getTournamentTxClient } from "./tournamentTx";
import { getSigningClient } from "./cosmos/client";

jest.mock("./cosmos/client", () => ({ getSigningClient: jest.fn() }));

const NETWORK: NetworkEndpoints = { name: "test", rpc: "http://rpc", rest: "http://rest", grpc: "http://grpc", ws: "ws://ws" };

const PARAMS: CreateTournamentParams = {
    buyIn: 1_000_000n,
    entryFee: 0n,
    startingStack: 1500n,
    seatsPerTable: 9,
    minEntrants: 2,
    maxEntrants: 27,
    startTime: 1_800_000_000,
    blindStructure: { preset: "turbo" },
    actionTimeoutSeconds: 25
};

const signingClient = {
    createTournament: jest.fn(),
    registerTournament: jest.fn(),
    unregisterTournament: jest.fn()
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSigningClient).mockResolvedValue({ signingClient, userAddress: "b52player" } as unknown as Awaited<ReturnType<typeof getSigningClient>>);
});

describe("tournament transactions", () => {
    it("creates through the SDK and returns the hash and the chain's tournament id", async () => {
        signingClient.createTournament.mockResolvedValue({ transactionHash: "ABC", tournamentId: "0xt1" });
        await expect(getTournamentTxClient(NETWORK).createTournament(PARAMS)).resolves.toEqual({ txHash: "ABC", tournamentId: "0xt1" });
        expect(signingClient.createTournament).toHaveBeenCalledWith(PARAMS);
        expect(getSigningClient).toHaveBeenCalledWith(NETWORK);
    });

    it("registers and unregisters by tournament id", async () => {
        signingClient.registerTournament.mockResolvedValue("REG");
        signingClient.unregisterTournament.mockResolvedValue("UNREG");
        const client = getTournamentTxClient(NETWORK);
        await expect(client.registerTournament("0xt1")).resolves.toEqual({ txHash: "REG" });
        await expect(client.unregisterTournament("0xt1")).resolves.toEqual({ txHash: "UNREG" });
        expect(signingClient.registerTournament).toHaveBeenCalledWith("0xt1");
        expect(signingClient.unregisterTournament).toHaveBeenCalledWith("0xt1");
    });

    it("lets the chain's rejection through unchanged", async () => {
        signingClient.registerTournament.mockRejectedValue(new Error("register tournament failed: tournament is full"));
        await expect(getTournamentTxClient(NETWORK).registerTournament("0xt1")).rejects.toThrow("tournament is full");
    });

    it("fails without a wallet the way the signing client does", async () => {
        jest.mocked(getSigningClient).mockRejectedValue(new Error("Block52 wallet not initialized."));
        await expect(getTournamentTxClient(NETWORK).registerTournament("0xt1")).rejects.toThrow("wallet not initialized");
    });
});
