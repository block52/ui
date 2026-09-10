/**
 * Runout frame expansion (plan: docs/plans/2026_09_09_runout_frame_expansion.md §2).
 *
 * `expandFrames(prev, next)` is a PURE function that turns ONE snapshot which
 * jumped several streets at once — the all-in runout, where the engine deals
 * flop, turn and river inside a single `performAction` with no yield point
 * (poker-vm `texasHoldem.ts:1340-1367`) — into an ORDERED LIST of snapshots the
 * bus can commit one at a time.
 *
 * Why this exists: the bus queues SNAPSHOTS, not presentation steps. One
 * snapshot is one atomic React commit, so the drain can space things *between*
 * commits but has no way to space anything *within* one. That is why a runout
 * paints the winner, the payout and all five cards simultaneously — no amount of
 * `minDisplayMs`/`holdPreviousMs` tuning can reorder events inside a single
 * commit. Splitting the frame gives the existing drain the commit boundaries it
 * needs, and every decorator then works unchanged (§2.4).
 *
 * NOTHING IS INVENTED (Commandment 7). Every field of every intermediate frame
 * is copied from `prev` or `next` — no defaults, no coercion, no arithmetic:
 *
 *   base    = prev, with `previousActions`/`actionCount` carried forward from
 *             next (so the triggering CALL's badge and sound fire on the FIRST
 *             beat rather than after the river) and any newly-revealed hole
 *             cards applied.
 *   frame_i = base, with `round` and `communityCards` advanced to street i.
 *   final   = next, VERBATIM (returned by identity).
 *
 * `stack`, `pots` and `winners` therefore hold their PRE-SHOWDOWN values until
 * the final frame — the payout lands with the winner, not before the flop. The
 * known cosmetic gap is that the caller's committed chips are not visible during
 * the runout; see the plan's Phase 3.
 *
 * Returns `[next]` unchanged whenever expansion does not apply, so normal play
 * takes the existing single-frame path with zero added latency.
 */
import type { TexasHoldemStateDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
import { isMaskedHand, isRevealedHand } from "./deriveEvents";

/**
 * Board size after each dealing street. The engine's own schedule
 * (`roundTransitionManager.ts:47-58`): PREFLOP deals 3, FLOP deals 1, TURN
 * deals 1 — i.e. the board is 3, then 4, then 5 cards. ANTE/PREFLOP/SHOWDOWN/END
 * deal nothing and never appear here.
 */
const DEALING_STREETS: readonly { round: TexasHoldemRound; boardSize: number }[] = [
    { round: TexasHoldemRound.FLOP, boardSize: 3 },
    { round: TexasHoldemRound.TURN, boardSize: 4 },
    { round: TexasHoldemRound.RIVER, boardSize: 5 }
];

/**
 * Merge newly-revealed hole cards from `next` onto `prev`'s players, per seat.
 * Only a masked -> revealed transition is carried (the same predicate pair
 * {@link deriveEvents} uses to emit `cardsRevealed`); everything else keeps its
 * `prev` value, so a seat that was already visible is untouched.
 *
 * @returns the merged roster, or null when no seat revealed anything.
 */
function mergeRevealedHoleCards(prev: TexasHoldemStateDTO, next: TexasHoldemStateDTO): PlayerDTO[] | null {
    const nextBySeat = new Map<number, PlayerDTO>();
    for (const player of next.players) {
        nextBySeat.set(player.seat, player);
    }

    let revealed = false;
    const merged = prev.players.map(player => {
        const nextPlayer = nextBySeat.get(player.seat);
        if (nextPlayer && isMaskedHand(player.holeCards) && isRevealedHand(nextPlayer.holeCards)) {
            revealed = true;
            return { ...player, holeCards: nextPlayer.holeCards };
        }
        return player;
    });

    return revealed ? merged : null;
}

/**
 * Split a multi-street snapshot jump into the frames it collapsed.
 *
 * @param prev - the last snapshot seen at ingest, or undefined for the first
 *   frame after subscribe/reset.
 * @param next - the newly-arrived snapshot.
 * @returns an ordered list of snapshots to commit. Always ends with `next`
 *   itself (by identity). `[next]` alone when expansion does not apply:
 *   no previous frame, a hand boundary, no newly-dealt cards (a fold-to-showdown
 *   or uncalled-bet win jumps `round` but deals nothing), a single-street
 *   advance, or a board length that does not match the engine's schedule.
 */
export function expandFrames(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): TexasHoldemStateDTO[] {
    // No baseline to project from — the frame simply seeds the next call.
    if (prev === undefined) {
        return [next];
    }

    // A hand boundary resets the board; that is not a street advance.
    if (prev.handNumber !== next.handNumber) {
        return [next];
    }

    const prevBoard = prev.communityCards.length;
    const nextBoard = next.communityCards.length;

    // The streets whose cards are new in `next`. A board length that is not on
    // the engine's schedule (a short or malformed frame) simply yields fewer
    // streets — we decline to synthesize rather than guess (Commandment 7).
    const dealtStreets = DEALING_STREETS.filter(street => street.boardSize > prevBoard && street.boardSize <= nextBoard);

    // Nothing dealt, or one street dealt: the existing single-frame path already
    // renders this correctly, and it must stay latency-free.
    if (dealtStreets.length < 2) {
        return [next];
    }

    // ---- base: prev, carrying forward only what belongs on the FIRST beat ----
    const revealedPlayers = mergeRevealedHoleCards(prev, next);
    const base: TexasHoldemStateDTO = {
        ...prev,
        // The action that triggered the runout is already in next's log. Carrying
        // it onto the first frame fires its badge and sound before the flop
        // instead of after the river.
        previousActions: next.previousActions,
        actionCount: next.actionCount,
        // Applied to the base (not just the reveal frame) so the cards stay face
        // up for the rest of the runout instead of flipping back to "X".
        ...(revealedPlayers ? { players: revealedPlayers } : {})
    };

    const frames: TexasHoldemStateDTO[] = [];

    // Beat 0 — all-in players' cards go face up before any board card lands
    // (the engine force-shows them: go/engine/showdown.go:5-19). Emitted only
    // when a seat actually revealed, so no empty commit in the heads-up case
    // where the viewer already sees every hand.
    if (revealedPlayers) {
        frames.push(base);
    }

    // One frame per street, each carrying only that street's cards.
    for (const street of dealtStreets) {
        frames.push({
            ...base,
            round: street.round,
            communityCards: next.communityCards.slice(0, street.boardSize)
        });
    }

    // The real snapshot, verbatim — `handEnded`, the payout and the final stacks
    // derive here and nowhere earlier.
    frames.push(next);

    return frames;
}
