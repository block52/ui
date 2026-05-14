import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { getSigningClient } from "../../utils/cosmos/client";
import type { JoinTableOptions } from "./types";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { JoinTableResult } from "../../types";

/**
 * Joins a poker table using Cosmos SDK SigningCosmosClient.
 *
 * @param {string} tableId - The ID of the table to join (game ID on Cosmos).
 * @param {JoinTableOptions} options - Options for joining the table, including buy-in amount and seat number.
 * @param {NetworkEndpoints} network - The current network configuration from NetworkContext.
 * @returns {Promise<JoinTableResult>} - The transaction result including hash, gameId, seat, and buyInAmount.
 * @throws {Error} - If the table ID is not provided or if an error occurs during the join operation.
 */
export async function joinTable(tableId: string, options: JoinTableOptions, network: NetworkEndpoints): Promise<JoinTableResult> {
    if (!tableId) {
        throw new Error("Table ID is required to join a table");
    }

    const { signingClient } = await getSigningClient(network);


    // Convert buy-in amount from USDC to micro-USDC (b52usdc)
    // options.amount is in USDC (e.g., "5.00"), need to convert to micro-units (e.g., 5000000)
    const amountInUsdc = parseFloat(options.amount);
    const buyInAmount = BigInt(Math.floor(amountInUsdc * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)));

    // If seatNumber is not provided, default to 0
    const seat = options.seatNumber !== undefined && options.seatNumber !== null
        ? options.seatNumber
        : 0;


    // Call SigningCosmosClient.joinGame()
    const transactionHash = await signingClient.joinGame(
        tableId,
        seat,
        buyInAmount
    );


    return {
        hash: transactionHash,
        gameId: tableId,
        seat,
        buyInAmount: buyInAmount.toString()
    };
}
