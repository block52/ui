import { COSMOS_CONSTANTS, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { getSigningClient } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import type { JoinTableOptions } from "./types";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { JoinTableResult } from "../../types";
import { hasValue, isNullish } from "../../utils/guards";

/**
 * Resolves the concrete seat a join should claim.
 *
 * "Random seat" used to be expressed as seat 0 ("let the server pick"), but
 * that only ever worked for cash: the engine's Sit-and-Go / tournament JOIN
 * does NOT treat 0 as random — it seats the player literally at 0, the
 * "not-seated" sentinel (chain seats are 1-indexed), so the join lands broken.
 * When no seat is requested we therefore pick a real empty seat from the latest
 * broadcast state instead of sending 0.
 */
export function resolveJoinSeat(requestedSeat: number | undefined, gameState: TexasHoldemStateDTO | undefined): number {
    if (hasValue(requestedSeat) && requestedSeat > 0) {
        return requestedSeat;
    }

    const maxPlayers = gameState?.gameOptions?.maxPlayers;
    if (isNullish(maxPlayers)) {
        // Per Commandment 7: surface it — never fall back to the broken seat 0.
        throw new Error("Cannot resolve a seat to join — game state not loaded yet");
    }

    const occupied = new Set((gameState?.players ?? []).map(p => p.seat));
    for (let seat = 1; seat <= maxPlayers; seat++) {
        if (!occupied.has(seat)) {
            return seat;
        }
    }
    throw new Error("No available seats to join");
}

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

    // Resolve a real seat — never the broken seat-0 "random" sentinel (which
    // the SNG/tournament engine mis-seats). See resolveJoinSeat.
    const seat = resolveJoinSeat(options.seatNumber, getLatestGameState());

    // Broadcast MsgJoinGame chain-direct.
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
