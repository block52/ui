/**
 * SNG finishing-order helper.
 *
 * For a LEAVE on a finished Sit-and-Go, the chain needs the place-1-first
 * finishing order to finalize and pay the prize — under WS-first it never saw
 * the tournament-ending gameplay action, so its Results are empty until we tell
 * it the order (pokerchain#229). The chain re-validates the ordering and owns
 * the payout amounts; we only report who finished where, from the broadcast
 * state's results[].
 */
import { hasElements } from "../guards";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/**
 * Derives the place-1-first finishing order (player addresses) from a finished
 * SNG's results[]. Empty when the game isn't finalized (no results), so the
 * chain falls back to its own state for cash/already-finalized leaves.
 */
export function finishingOrderFromState(gameState: TexasHoldemStateDTO | undefined): string[] {
    const results = gameState?.results;
    if (!hasElements(results)) {
        return [];
    }
    return [...results].sort((a, b) => a.place - b.place).map(r => r.playerId);
}
