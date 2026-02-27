import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import type { SitOutMethod } from "@block52/poker-vm-sdk";
import { SIT_OUT_METHOD_NEXT_HAND } from "@block52/poker-vm-sdk";

export { SIT_OUT_METHOD_NEXT_HAND };
export { SIT_OUT_METHOD_NEXT_BB } from "@block52/poker-vm-sdk";
export type { SitOutMethod } from "@block52/poker-vm-sdk";

/**
 * Sit out in a poker game using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) where the action will be performed
 * @param network - The current network configuration from NetworkContext
 * @param method - The sit-out method: "next-hand" or "next-bb"
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function sitOut(
    tableId: string,
    network: NetworkEndpoints,
    method: SitOutMethod = SIT_OUT_METHOD_NEXT_HAND
): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);

    const transactionHash = await signingClient.performAction(
        tableId,
        "sit-out",
        0n,
        `method=${method}`
    );

    return {
        hash: transactionHash,
        gameId: tableId,
        action: "sit-out"
    };
}
