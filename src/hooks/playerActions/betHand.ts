import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "@block52/poker-ui-core/types";
import { executeTransportAction } from "./transportAction";

/**
 * Bet in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The amount to bet in micro-units as bigint (10^6 precision)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function betHand(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.BET, amount, network);
}
