/**
 * Event derivation (WS Action Bus, Phase 2).
 *
 * `deriveEvents(prev, next)` is a PURE function that diffs two consecutive game
 * snapshots and returns the typed transitions that happened between them
 * ({@link GameEvent}). It replaces the hand-rolled `useRef`-diffing scattered
 * across sound/animation/badge hooks (plan §1.2) with one centralized,
 * heavily-tested source of truth (Commandment 12).
 *
 * Key semantics (plan §2.3 / §5.5):
 *
 *   - Action indices are GLOBALLY MONOTONIC across hands. The `previousActions`
 *     array is replaced with the current hand's actions each hand, but indices
 *     keep climbing (a live hand 4 runs indices 34+ atop actionCount 33). So the
 *     dedup baseline is simply the max index present in `prev.previousActions` —
 *     that is the persistent `lastSeenIndex`, with NO per-hand reset. Every
 *     `previousActions` entry in `next` with `index > baseline` yields one
 *     `playerActed`, in index order (a coalesced multi-action gap → several
 *     events).
 *
 *   - `prev === undefined` (first frame after subscribe/reset) → NO synthetic
 *     events. History is not replayed as fresh events; the frame simply becomes
 *     the baseline for the next call.
 *
 *   - Non-player actions (deal, blind posts) are carried whole in `playerActed`
 *     so consumers can distinguish them (the `action.action` discriminates
 *     PlayerActionType vs NonPlayerActionType).
 *
 *   - Per Commandment 7, a regressed snapshot (indices go backwards while the
 *     hand number is unchanged) is NOT silently accepted — it throws
 *     {@link RegressedSnapshotError}. The bus catches this, surfaces it via
 *     console.error, and commits the frame with no events (the snapshot itself
 *     is never dropped — the render track stays alive). This mirrors ingest.ts's
 *     "surface, never default" stance while keeping derivation a pure throw-or-
 *     return function per plan §2.3 ("derivation throws/flags ... rather than
 *     defaulting").
 */
import type { TexasHoldemStateDTO, ActionDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { GameEvent } from "./types";
import { hasElements, isEmpty } from "../utils/guards";

/**
 * Thrown by {@link deriveEvents} when a same-hand snapshot's action indices
 * regress (a stale/out-of-order frame). Surfaced by the bus, never swallowed.
 */
export class RegressedSnapshotError extends Error {
    public readonly prevMaxIndex: number;
    public readonly nextMaxIndex: number;
    public readonly handNumber: number;

    constructor(prevMaxIndex: number, nextMaxIndex: number, handNumber: number) {
        super(
            `Regressed snapshot: previousActions max index went backwards from ${prevMaxIndex} to ${nextMaxIndex} ` +
                `without a handNumber change (hand ${handNumber}). Refusing to derive events from a stale frame.`
        );
        this.name = "RegressedSnapshotError";
        this.prevMaxIndex = prevMaxIndex;
        this.nextMaxIndex = nextMaxIndex;
        this.handNumber = handNumber;
    }
}

/** Linear street order — the index in this array defines "forward" progression. */
const ROUND_ORDER: readonly TexasHoldemRound[] = [
    TexasHoldemRound.ANTE,
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN,
    TexasHoldemRound.END
];

function roundOrder(round: TexasHoldemRound): number {
    return ROUND_ORDER.indexOf(round);
}

/** Highest action index present, or null when there are no actions. */
function maxActionIndex(actions: readonly ActionDTO[] | undefined): number | null {
    if (!actions || actions.length === 0) {
        return null;
    }
    let max = actions[0].index;
    for (const action of actions) {
        if (action.index > max) {
            max = action.index;
        }
    }
    return max;
}

/** Placeholder tokens the chain/stub use for a card the viewer may not see. */
function isMaskedCard(card: string): boolean {
    return card === "X" || card === "??";
}

/** A hand that has cards, every one of them masked (e.g. ["X","X"]). */
export function isMaskedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(isMaskedCard);
}

/** A hand that has cards, none of them masked (real, viewable cards). */
export function isRevealedHand(cards: string[] | undefined): boolean {
    return hasElements(cards) && cards.every(card => !isMaskedCard(card));
}

function playersBySeat(players: readonly PlayerDTO[]): Map<number, PlayerDTO> {
    const map = new Map<number, PlayerDTO>();
    for (const player of players) {
        map.set(player.seat, player);
    }
    return map;
}

/**
 * Derive the typed transitions between two consecutive snapshots.
 *
 * @param prev - the last snapshot seen at ingest, or undefined for the first
 *   frame after subscribe/reset (returns [] — no synthetic history replay).
 * @param next - the newly-arrived snapshot.
 * @returns the events that occurred, in a deterministic order (structural
 *   join/leave, then handStarted, playerActed in index order, roundAdvanced,
 *   cardsRevealed, stackChanged, handEnded).
 * @throws {RegressedSnapshotError} when same-hand action indices regress.
 */
export function deriveEvents(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): GameEvent[] {
    // First frame after subscribe/reset — seed the baseline, emit nothing.
    if (prev === undefined) {
        return [];
    }

    const handAdvanced = next.handNumber > prev.handNumber;
    const sameHand = next.handNumber === prev.handNumber;

    const prevMax = maxActionIndex(prev.previousActions);
    const nextMax = maxActionIndex(next.previousActions);

    // Commandment 7: a same-hand frame whose indices went backwards is a stale /
    // out-of-order frame — surface it, do not silently accept.
    if (sameHand && prevMax !== null && nextMax !== null && nextMax < prevMax) {
        throw new RegressedSnapshotError(prevMax, nextMax, next.handNumber);
    }

    const events: GameEvent[] = [];

    // --- structural: players joining / leaving (diff by seat) ---------------
    const prevSeats = playersBySeat(prev.players);
    const nextSeats = playersBySeat(next.players);
    for (const [seat, player] of nextSeats) {
        if (!prevSeats.has(seat)) {
            events.push({ type: "playerJoined", seat, address: player.address });
        }
    }
    for (const [seat, player] of prevSeats) {
        if (!nextSeats.has(seat)) {
            events.push({ type: "playerLeft", seat, address: player.address });
        }
    }

    // --- handStarted --------------------------------------------------------
    if (handAdvanced) {
        events.push({ type: "handStarted", handNumber: next.handNumber });
    }

    // --- playerActed: every new previousActions entry, in index order -------
    // Baseline is the persistent lastSeenIndex (max index in prev). Because
    // indices are globally monotonic, this works across the hand boundary: the
    // array is replaced with the new hand's actions but their indices are all
    // greater than the previous hand's max, so nothing is missed or replayed.
    const baseline = prevMax ?? -1;
    const newActions = next.previousActions.filter(action => action.index > baseline).sort((a, b) => a.index - b.index);
    for (const action of newActions) {
        events.push({ type: "playerActed", action });
    }

    // --- roundAdvanced: same hand, street moved forward ---------------------
    // Guarded to the same hand so a new hand's end->preflop reset is not
    // mistaken for a round transition. A single frame can jump multiple streets
    // (all-in runout); newCommunityCards is whatever community cards are new.
    if (sameHand && next.round !== prev.round && roundOrder(next.round) > roundOrder(prev.round)) {
        const newCommunityCards = next.communityCards.slice(prev.communityCards.length);
        events.push({ type: "roundAdvanced", from: prev.round, to: next.round, newCommunityCards });
    }

    // --- cardsRevealed: masked ["X","X"] -> real cards, per seat ------------
    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && isMaskedHand(prevPlayer.holeCards) && isRevealedHand(nextPlayer.holeCards)) {
            events.push({ type: "cardsRevealed", seat, cards: nextPlayer.holeCards as string[] });
        }
    }

    // --- stackChanged: per seat present in both, stack string differs -------
    for (const [seat, nextPlayer] of nextSeats) {
        const prevPlayer = prevSeats.get(seat);
        if (prevPlayer && prevPlayer.stack !== nextPlayer.stack) {
            events.push({ type: "stackChanged", seat, from: prevPlayer.stack, to: nextPlayer.stack });
        }
    }

    // --- handEnded: winners transition from empty to populated --------------
    if (hasElements(next.winners) && isEmpty(prev.winners)) {
        events.push({ type: "handEnded", winners: next.winners });
    }

    return events;
}
