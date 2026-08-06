import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { generatePlayerSeedHex } from "../../utils/entropy";
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
    // player supplies 32 bytes of entropy as data "seed=<hex>"; the chain shuffles
    // the deck deterministically from it (ShuffleFromVRF). The client no longer
    // picks the deck — a client deck is what forked the chain from the gateway
    // (poker-vm#2418).
    //
    // Always send the seed — on BOTH transports (pokerchain#265). A seeded deck is
    // deterministic from the tx, so the optimistic mempool oracle can reproduce it
    // (same ShuffleFromVRF) and surface new-hand/deal at ~250ms instead of ~5s. A
    // seedless new-hand falls back to a chain-state shuffle the oracle can't
    // reproduce, so it would still lag to commit.
    const data = `seed=${generatePlayerSeedHex()}`;
    return executeTransportAction(tableId, NonPlayerActionType.NEW_HAND, 0n, network, data);
}
