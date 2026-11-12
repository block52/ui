/**
 * When the live win% chip is allowed on a seat, and the exact showdown share
 * once the board is complete (ui#210).
 *
 * `useAllInEquity` used to open only when every still-in player was ALL_IN or
 * SHOWING, or the round was already SHOWDOWN/END. An all-in runout is one
 * engine snapshot split into reveal → flop → turn → river frames whose round
 * is still the street. Those frames keep the previous statuses: the last
 * caller is often still ACTIVE, and a tournament loser is BUSTED with
 * `cardsShown` rather than SHOWING. One of those seats closed the gate for
 * the whole table until the result frame.
 */
import {
    Deck,
    GameVariant,
    PlayerStatus,
    PokerSolver,
    TexasHoldemRound,
    type PlayerDTO
} from "@block52/poker-vm-sdk";
import { isRevealedHand } from "../bus/deriveEvents";
import { hasValue, isEmpty, safeLength } from "./guards";
import { hasFoldedOrMucked } from "./playerStatus";

/** A seat the equity math needs. SDK fields only — no parallel player type. */
export type EquityPlayer = Pick<PlayerDTO, "seat" | "status" | "holeCards" | "cardsShown">;

export interface AllInEquityInput {
    players: readonly EquityPlayer[];
    round: TexasHoldemRound | undefined;
    nextToAct: number | undefined;
    /** Two for Hold'em, four for Omaha. */
    holeCount: number;
    shownBySeat?: ReadonlyMap<number, { holeCards?: string[] }>;
}

/**
 * Betting is closed when the turn pointer is not a seat.
 *
 * Seats are 1-based. The engine clears the pointer with -1 on a runout
 * (ui#968). 0 is the same "nobody" sentinel the turn clock already treats as
 * no turn.
 */
export function isBettingClosed(nextToAct: number | null | undefined): boolean {
    return hasValue(nextToAct) && nextToAct < 1;
}

/**
 * Still contesting this hand for equity purposes.
 *
 * Folded and mucked seats are out. A busted player (or a cash player moved to
 * sitting-out on the payout) counts only while the engine left the hand
 * tabled with `cardsShown` — they were in the all-in. Sitting out, waiting,
 * or merely seated without that mark is not in the hand.
 */
export function contestsAllInEquity(player: Pick<PlayerDTO, "status" | "cardsShown">): boolean {
    if (hasFoldedOrMucked(player.status)) return false;
    if (player.status === PlayerStatus.BUSTED || player.status === PlayerStatus.SITTING_OUT) {
        return player.cardsShown === true;
    }
    if (
        player.status === PlayerStatus.SEATED
        || player.status === PlayerStatus.SITTING_IN
        || player.status === PlayerStatus.WAITING_FOR_BIG_BLIND
    ) {
        return false;
    }
    return true;
}

function faceUpHoleCards(
    player: Pick<PlayerDTO, "holeCards">,
    holeCount: number,
    shown: string[] | undefined
): string[] | null {
    if (hasValue(shown) && safeLength(shown) === holeCount) {
        const copy = [...shown];
        if (isRevealedHand(copy)) return copy;
    }
    const hole = player.holeCards;
    if (hasValue(hole) && safeLength(hole) === holeCount && isRevealedHand(hole)) {
        return [...hole];
    }
    return null;
}

/** Face-up hands of players still in the pot, folded seats excluded. */
export function equityHands(
    players: readonly EquityPlayer[],
    holeCount: number,
    shownBySeat?: ReadonlyMap<number, { holeCards?: string[] }>
): Array<{ seat: number; cards: string[] }> {
    const hands: Array<{ seat: number; cards: string[] }> = [];
    for (const player of players) {
        if (!contestsAllInEquity(player)) continue;
        const shown = shownBySeat?.get(player.seat)?.holeCards;
        const cards = faceUpHoleCards(player, holeCount, shown);
        if (!hasValue(cards)) continue;
        hands.push({ seat: player.seat, cards });
    }
    return hands;
}

/**
 * Open the win% chip.
 *
 *   A) Every contesting player is all-in or showing, and every one of those
 *      hands is face up (issue #32).
 *   B) Showdown or end, with two or more face-up hands (issue #313).
 *   C) Betting is closed and every contesting hand is face up — the all-in
 *      runout, including an ACTIVE last caller and BUSTED losers (ui#210).
 */
export function shouldShowAllInEquity(input: AllInEquityInput): boolean {
    const hands = equityHands(input.players, input.holeCount, input.shownBySeat);
    if (safeLength(hands) < 2) return false;

    const contesting = input.players.filter(contestsAllInEquity);
    const allVisible = safeLength(hands) === safeLength(contesting);
    const allInOrShowing = contesting.every(
        player => player.status === PlayerStatus.ALL_IN || player.status === PlayerStatus.SHOWING
    );

    if (allInOrShowing && allVisible) return true;
    if (input.round === TexasHoldemRound.SHOWDOWN || input.round === TexasHoldemRound.END) return true;
    if (isBettingClosed(input.nextToAct) && allVisible) return true;
    return false;
}

/**
 * Status painted on a runout sub-frame.
 *
 * The final frame stays the engine snapshot. Until then a folded seat stays
 * folded, a seat already all-in or showing keeps that, and a face-up seat
 * that is still in the hand is SHOWING: the last caller the engine left
 * ACTIVE, and a loser it already marked BUSTED (or sitting-out) with
 * `cardsShown`. One leftover ACTIVE seat used to hide win% on every street.
 */
export function runoutSubframeStatus(
    prev: Pick<PlayerDTO, "status" | "holeCards">,
    next: Pick<PlayerDTO, "status" | "holeCards" | "cardsShown">
): PlayerStatus {
    if (next.status === PlayerStatus.FOLDED || next.status === PlayerStatus.MUCKED) {
        return next.status;
    }
    if (prev.status === PlayerStatus.ALL_IN || prev.status === PlayerStatus.SHOWING) {
        return prev.status;
    }
    if (next.status === PlayerStatus.ALL_IN || next.status === PlayerStatus.SHOWING) {
        return next.status;
    }
    const faceUp = isRevealedHand(next.holeCards) || isRevealedHand(prev.holeCards);
    const tabledOut = next.cardsShown === true
        && (next.status === PlayerStatus.BUSTED || next.status === PlayerStatus.SITTING_OUT);
    const coveringCaller = prev.status === PlayerStatus.ACTIVE || next.status === PlayerStatus.ACTIVE;
    if (faceUp && !hasFoldedOrMucked(prev.status) && (tabledOut || coveringCaller)) {
        return PlayerStatus.SHOWING;
    }
    return prev.status;
}

/**
 * Win shares once five board cards are out: 100 for the winner, an equal
 * split on a chop, 0 for everyone else. Monte Carlo on a finished board is
 * the same answer with extra noise; this is exact.
 * Returns null when the board is short or a card does not parse, so the
 * caller can fall back to the simulation.
 */
export function exactShowdownWinPercentages(
    hands: string[][],
    board: string[],
    variant: GameVariant | string | undefined
): number[] | null {
    if (safeLength(board) !== 5 || safeLength(hands) < 2) return null;
    try {
        const boardCards = board.map(card => Deck.fromString(card));
        const evaluations = hands.map(hand => {
            const hole = hand.map(card => Deck.fromString(card));
            if (variant === GameVariant.OMAHA) {
                return PokerSolver.findBestOmahaHand(hole, boardCards);
            }
            return PokerSolver.findBestHand([...hole, ...boardCards]);
        });
        const winners = PokerSolver.findWinners(evaluations);
        if (isEmpty(winners)) return null;
        const share = 100 / safeLength(winners);
        const winnerSet = new Set(winners);
        return hands.map((_hand, index) => (winnerSet.has(index) ? share : 0));
    } catch (err) {
        console.error("Exact showdown equity failed:", err);
        return null;
    }
}
