import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";

/**
 * Start a new hand at a poker table using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to start a new hand
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function startNewHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    const { signingClient, userAddress } = await getSigningClient(network);


    const transactionHash = await signingClient.performActionSync(
        tableId,
        "new-hand",
        0n
    );


    return {
        hash: transactionHash,
        gameId: tableId,
        action: "new-hand"
    };
}
