import type { PlayerDTO } from "@block52/poker-vm-sdk";
import { hasValue, hasContent, hasElements } from "./guards";

/**
 * Returns true when the given seat is the big-blind position for the current
 * hand. Both inputs may be undefined (player not seated yet, or game state
 * not loaded), in which case the result is false rather than throwing — the
 * call sites are auto-action guards where "we don't know yet" should mean
 * "don't fire."
 *
 * Seat 0 is treated as not-seated. Chain seats are 1-indexed.
 */
export function isSeatBigBlind(
    seat: number | undefined,
    bigBlindPosition: number | undefined
): boolean {
    return hasValue(seat) && seat > 0 && hasValue(bigBlindPosition) && bigBlindPosition === seat;
}

interface GameStateLike {
    players?: Array<Pick<PlayerDTO, "address" | "seat">>;
}

/**
 * Find the user's seat number in a game state by matching the cosmos address
 * (case-insensitive). Returns `undefined` when the user isn't seated or when
 * either input is missing, so callers can pass the result straight into hooks
 * that already accept `number | undefined`.
 *
 * Centralizes the lookup so we don't repeat the localStorage + lowercase
 * + find pattern from `usePlayerSeatInfo` in every component that needs it.
 */
export function findUserSeat(
    gameState: GameStateLike | null | undefined,
    userAddress: string | null | undefined
): number | undefined {
    const players = gameState?.players;
    if (!hasContent(userAddress) || !hasElements(players)) return undefined;
    const wanted = userAddress.toLowerCase();
    return players.find(p => p.address?.toLowerCase() === wanted)?.seat;
}
