import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "@block52/poker-ui-core/types";
import { executeTransportAction } from "./transportAction";

/**
 * Deal cards in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to deal cards
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function dealCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.DEAL, 0n, network);
}

/**
 * Deal cards with user-provided entropy for provably fair shuffling.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to deal cards
 * @param network - The current network configuration from NetworkContext
 * @param entropy - The entropy string (hex) to use for deck shuffling
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function dealCardsWithEntropy(
    tableId: string,
    network: NetworkEndpoints,
    entropy: string
): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.DEAL, 0n, network, entropy);
}
