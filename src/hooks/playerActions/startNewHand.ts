import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { generatePlayerSeedHex } from "../../utils/entropy";
import { getGameTransport } from "../../utils/gameTransport";
import { executeTransportAction } from "./transportAction";

/**
 * Start a new hand at a poker table using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where to start a new hand
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function startNewHand(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    // The chain is the authoritative deck source (poker-vm#2450). The acting
    // player supplies 32 bytes of entropy as data "seed=<hex>"; the chain folds
    // it into the per-hand VRF (deck = player seed ⊕ proposer VRF) and shuffles.
    // The client no longer picks the deck — a client deck is what forked the
    // chain from the gateway (poker-vm#2418).
    const data = getGameTransport() === "gateway" ? `seed=${generatePlayerSeedHex()}` : undefined;
    return executeTransportAction(tableId, NonPlayerActionType.NEW_HAND, 0n, network, data);
}
