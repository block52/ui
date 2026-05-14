import { getSigningClient } from "../../utils/cosmos/client";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { LeaveTableResult } from "../../types";

/**
 * Leave a poker table using Cosmos SDK SigningCosmosClient.
 *
 * @param tableId - The ID of the table (game ID on Cosmos) to leave
 * @param value - The value to leave with (as string, in microunits)
 * @param network - The current network configuration from NetworkContext
 * @param _nonce - Optional nonce (not used in Cosmos SDK, kept for compatibility)
 * @returns Promise with LeaveTableResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function leaveTable(tableId: string, value: string, network: NetworkEndpoints, _nonce?: number): Promise<LeaveTableResult> {
    const { signingClient } = await getSigningClient(network);


    // Call SigningCosmosClient.performAction() with "leave" action
    const transactionHash = await signingClient.performActionSync(
        tableId,
        NonPlayerActionType.LEAVE,
        BigInt(value)
    );


    return {
        hash: transactionHash,
        gameId: tableId,
        action: NonPlayerActionType.LEAVE,
        value
    };
}
