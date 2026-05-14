import { getSigningClient } from "../../utils/cosmos/client";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";

/**
 * Show cards in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function showCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);


    const transactionHash = await signingClient.performActionSync(
        tableId,
        PlayerActionType.SHOW,
        0n
    );


    return {
        hash: transactionHash,
        gameId: tableId,
        action: PlayerActionType.SHOW
    };
}
