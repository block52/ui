import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Go all-in in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * Used for the short-shove case (poker-vm#2244): a player facing a bet whose
 * stack is more than the call but less than a full min-raise can't RAISE, so
 * the engine advertises ALL_IN instead. The amount is the player's whole stack
 * (the `all-in` legal action's max).
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param amount - The all-in amount in micro-units as bigint (10^6 precision) — the player's full stack
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function allInHand(tableId: string, amount: bigint, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, PlayerActionType.ALL_IN, amount, network);
}
