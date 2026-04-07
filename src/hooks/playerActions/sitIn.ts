import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";

// TODO: Import from @block52/poker-vm-sdk once exported (see #1844)
export type SitInMethod = "next-bb" | "post-now";
// TODO: next-bb deferred until poker-vm#1895 is implemented
export const SIT_IN_METHOD_NEXT_BB: SitInMethod = "next-bb";
export const SIT_IN_METHOD_POST_NOW: SitInMethod = "post-now";

/**
 * Sit in at a poker table using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitIn(
    tableId: string,
    network: NetworkEndpoints,
    method: SitInMethod = SIT_IN_METHOD_POST_NOW
): Promise<PlayerActionResult> {
    console.log("🔧 sitIn() called with:", { tableId, method });
    console.log("🔑 Getting signing client...");
    const { signingClient, userAddress } = await getSigningClient(network);
    console.log("✅ Signing client obtained, userAddress:", userAddress);

    console.log("📡 Calling SDK performAction with:", {
        tableId,
        action: "sit-in",
        amount: "0n",
        data: `method=${method}`
    });

    const transactionHash = await signingClient.performAction(
        tableId,
        "sit-in",
        0n,
        `method=${method}`
    );

    console.log("✅ performAction returned hash:", transactionHash);

    return {
        hash: transactionHash,
        gameId: tableId,
        action: "sit-in"
    };
}
