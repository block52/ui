/**
 * The transaction side of multi-table tournaments (ui#980 slices 2-3): create,
 * register and unregister, signed by the player's Block52 wallet through the SDK's
 * SigningCosmosClient (@block52/poker-vm-sdk 1.25.0).
 *
 * The three calls sit behind {@link TournamentTxClient} so hooks and components
 * stay free of the signing client. The chain is gasless; a tx that the chain
 * rejects throws with the chain's own message, which the caller shows as it comes.
 */
import type { CreateTournamentParams } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";
import { getSigningClient } from "./cosmos/client";

export type { CreateTournamentParams };

export interface TournamentTxClient {
    /** Resolves once the tx is committed and executed; `tournamentId` is the id the chain derived. */
    createTournament(params: CreateTournamentParams): Promise<{ txHash: string; tournamentId: string }>;
    registerTournament(tournamentId: string): Promise<{ txHash: string }>;
    unregisterTournament(tournamentId: string): Promise<{ txHash: string }>;
}

/** The tournament transaction client for `network`, signing with the current Block52 wallet. */
export const getTournamentTxClient = (network: NetworkEndpoints): TournamentTxClient => ({
    createTournament: async params => {
        const { signingClient } = await getSigningClient(network);
        const { transactionHash, tournamentId } = await signingClient.createTournament(params);
        return { txHash: transactionHash, tournamentId };
    },
    registerTournament: async tournamentId => {
        const { signingClient } = await getSigningClient(network);
        return { txHash: await signingClient.registerTournament(tournamentId) };
    },
    unregisterTournament: async tournamentId => {
        const { signingClient } = await getSigningClient(network);
        return { txHash: await signingClient.unregisterTournament(tournamentId) };
    }
});
