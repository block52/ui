import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "@block52/poker-ui-core/types";
import { executeTransportAction } from "./transportAction";

/**
 * Muck cards in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function muckCards(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.MUCK, 0n, network);
}
