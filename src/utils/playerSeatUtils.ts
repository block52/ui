import type { PlayerDTO } from "@block52/poker-vm-sdk";
import { hasContent } from "./guards";

interface GameStateLike {
    players?: ReadonlyArray<Pick<PlayerDTO, "address" | "seat">>;
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
    if (!hasContent(userAddress) || !gameState?.players) return undefined;
    const wanted = userAddress.toLowerCase();
    const player = gameState.players.find(p => p.address?.toLowerCase() === wanted);
    return player?.seat;
}
