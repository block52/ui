import { PokerGameIntegration, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { isEmpty } from "./guards";

/**
 * Fills each winner's `name` and `description` (the hand in words, "Set of
 * Sevens") from its cards and the board, via the SDK. The engine no longer
 * writes the wording into chain state (poker-vm#2721), so every game state the
 * UI takes in passes through here and the rest of the UI keeps reading
 * `winner.description`.
 *
 * A state with no winners is returned as-is (nothing to describe). Otherwise a
 * new state object is returned; the input is not modified.
 *
 * @param state The game state as it arrived from the chain
 */
export function withWinnerDescriptions(state: TexasHoldemStateDTO): TexasHoldemStateDTO {
    if (isEmpty(state.winners)) return state;
    return PokerGameIntegration.withWinnerDescriptions(state);
}
