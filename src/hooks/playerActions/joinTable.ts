import { COSMOS_CONSTANTS, GameFormat, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { withMoneyMoverRetry } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import type { JoinTableOptions } from "./types";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { JoinTableResult } from "../../types";
import { hasValue, isEmpty, isNullish } from "../../utils/guards";
import { parseUsdcToMicro } from "../../constants/currency";
import { cryptoRandomInt, drawSeat, isSeatTakenError, openSeats, RandomInt, seatsAreDrawn } from "../../utils/seatDraw";

/**
 * How many seats a Sit & Go join tries before giving up when other joins keep
 * taking the drawn seat first (ui#969).
 */
export const MAX_SEAT_DRAW_ATTEMPTS = 3;

/**
 * Resolves the concrete seat a join should claim.
 *
 * - **Sit & Go / tournament:** the seat is drawn at random from the empty
 *   seats (ui#969); a requested seat is ignored, so no path lets a player pick
 *   where they sit. `exclude` holds seats an earlier attempt lost to another
 *   join, which the latest state may not show yet.
 * - **Cash:** the requested seat, or the lowest empty seat when none is given.
 *
 * Never seat 0: "random seat" used to be expressed as seat 0 ("let the server
 * pick"), but the engine's Sit-and-Go / tournament JOIN seats a 0 literally
 * (the "not-seated" sentinel; chain seats are 1-indexed), so the join lands
 * broken.
 */
export function resolveJoinSeat(
    requestedSeat: number | undefined,
    gameState: TexasHoldemStateDTO | undefined,
    format: GameFormat | undefined,
    exclude: ReadonlySet<number> = new Set(),
    randomInt: RandomInt = cryptoRandomInt
): number {
    if (isNullish(format)) {
        // Per Commandment 7: without the format we can't tell a chosen seat from a drawn one.
        throw new Error("Cannot resolve a seat to join — game format not loaded yet");
    }
    const drawn = seatsAreDrawn(format);

    if (!drawn && hasValue(requestedSeat) && requestedSeat > 0) {
        return requestedSeat;
    }

    const maxPlayers = gameState?.gameOptions?.maxPlayers;
    if (isNullish(maxPlayers)) {
        // Per Commandment 7: surface it — never fall back to the broken seat 0.
        throw new Error("Cannot resolve a seat to join — game state not loaded yet");
    }

    const seats = openSeats(
        maxPlayers,
        (gameState?.players ?? []).map(p => p.seat),
        exclude
    );
    if (isEmpty(seats)) {
        throw new Error("No available seats to join");
    }
    return drawn ? drawSeat(seats, randomInt) : seats[0];
}

/**
 * Joins a poker table using Cosmos SDK SigningCosmosClient.
 *
 * At a Sit & Go the seat is drawn (see resolveJoinSeat). If another join takes
 * the drawn seat first, the chain rejects ours with ErrSeatTaken and nothing
 * moves (the buy-in transfer is part of the failed tx), so we redraw from the
 * seats still open, up to MAX_SEAT_DRAW_ATTEMPTS. A cash join with a chosen
 * seat is never redrawn: the player asked for that seat.
 *
 * @param {string} tableId - The ID of the table to join (game ID on Cosmos).
 * @param {JoinTableOptions} options - Buy-in amount, the table's format, and (cash only) the chosen seat.
 * @param {NetworkEndpoints} network - The current network configuration from NetworkContext.
 * @returns {Promise<JoinTableResult>} - The transaction result including hash, gameId, seat, and buyInAmount.
 * @throws {Error} - If the table ID is not provided or if an error occurs during the join operation.
 */
export async function joinTable(tableId: string, options: JoinTableOptions, network: NetworkEndpoints): Promise<JoinTableResult> {
    if (!tableId) {
        throw new Error("Table ID is required to join a table");
    }

    // Convert buy-in amount from USDC to micro-USDC (b52usdc).
    // options.amount is already text (e.g. "5.00"), so parse it directly rather
    // than routing it through a float — parseFloat + multiply was short by one
    // micro-unit on 1.2% of cent amounts (#610).
    const buyInAmount = parseUsdcToMicro(options.amount);

    const lostSeats = new Set<number>();
    for (let attempt = 1; ; attempt++) {
        // Resolve a real seat from the latest broadcast state — never the
        // broken seat-0 "random" sentinel (which the SNG/tournament engine
        // mis-seats). See resolveJoinSeat.
        const seat = resolveJoinSeat(options.seatNumber, getLatestGameState(), options.format, lostSeats);

        try {
            // Broadcast MsgJoinGame chain-direct. JOIN is an ordered money-mover (it
            // carries the account sequence), so retry once on a sequence mismatch caused
            // by a still-pending prior money-mover (ui#530 follow-up) — otherwise a
            // wedged sequence blocks every join.
            const transactionHash = await withMoneyMoverRetry(network, ({ signingClient }) =>
                signingClient.joinGame(tableId, seat, buyInAmount)
            );

            return {
                hash: transactionHash,
                gameId: tableId,
                seat,
                buyInAmount: buyInAmount.toString()
            };
        } catch (err) {
            if (!seatsAreDrawn(options.format) || !isSeatTakenError(err) || attempt >= MAX_SEAT_DRAW_ATTEMPTS) {
                throw err;
            }
            console.warn(`[joinTable] seat ${seat} was taken by another join first; redrawing (attempt ${attempt} of ${MAX_SEAT_DRAW_ATTEMPTS})`);
            lostSeats.add(seat);
        }
    }
}
