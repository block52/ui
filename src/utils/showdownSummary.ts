/**
 * Showdown summary lines for the History panel (stop-gap for fast showdowns).
 *
 * All-in-and-called runouts resolve in one engine step and the table moves on
 * quickly, so the on-felt showdown can fly by. These pure helpers turn the END
 * snapshot into readable lines — "Seat 3 won with Two Pair over Pair, Kings —
 * $0.40" — that the History panel shows live and retains for the following
 * hand (see utils/lastHandResult).
 *
 * The chain only describes the WINNING hand (WinnerDTO.description); beaten
 * hands are evaluated client-side from the revealed hole cards + board with the
 * same SDK solver the live hand-strength display uses.
 */

import { Deck, PlayerStatus, PokerGameIntegration, PokerSolver, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { WinnerInfo } from "../types/index";
import { hasElements } from "./guards";

interface EvaluatedHand {
    description: string;
    /** SDK hand-type rank — higher is a stronger hand class. */
    score: number;
}

/**
 * Evaluate revealed hole cards + board into a human description, or null when
 * the cards are missing or masked ("X" placeholders don't parse).
 */
export const describeShownHand = (holeCards: string[] | undefined, communityCards: string[]): EvaluatedHand | null => {
    if (!holeCards || holeCards.length < 2) return null;
    try {
        const allCards = [...holeCards, ...communityCards];
        const cardObjects = allCards.map(cardStr => Deck.fromString(cardStr));
        const evaluation = PokerSolver.evaluatePartialHand(cardObjects);
        const description = allCards.length === 2 ? evaluation.description : PokerGameIntegration.formatHandDescription(evaluation);
        return { description, score: evaluation.handType };
    } catch {
        return null;
    }
};

/**
 * The strongest REVEALED losing hand at showdown — the "over …" clause.
 *
 * Only seats whose status is SHOWING or ALL_IN count as revealed: the local
 * player's own snapshot always carries their hole cards, so filtering by card
 * visibility alone would leak the hero's folded junk into the summary.
 */
export const getBeatenHandDescription = (
    gameState: TexasHoldemStateDTO | null | undefined,
    winners: WinnerInfo[] | null | undefined
): string | null => {
    if (!gameState || !hasElements(winners)) return null;

    const winnerAddresses = new Set((winners ?? []).map(w => w.address?.toLowerCase()));
    const board = gameState.communityCards ?? [];

    let best: EvaluatedHand | null = null;
    for (const player of gameState.players ?? []) {
        if (winnerAddresses.has(player.address?.toLowerCase())) continue;
        if (player.status !== PlayerStatus.SHOWING && player.status !== PlayerStatus.ALL_IN) continue;
        const hand = describeShownHand(player.holeCards, board);
        if (hand && (!best || hand.score > best.score)) {
            best = hand;
        }
    }
    return best?.description ?? null;
};

/**
 * One line per winner, in the user-requested "won with X over Y" shape:
 *   showdown:    "Seat 3 won with Two Pair over Pair, Kings — $0.40"
 *   no reveal:   "Seat 3 won with Two Pair — $0.40"
 *   uncontested: "Seat 3 wins $0.40 (uncontested)"
 */
export const getShowdownSummaryLines = (
    gameState: TexasHoldemStateDTO | null | undefined,
    winners: WinnerInfo[] | null | undefined
): string[] => {
    if (!hasElements(winners)) return [];

    const beaten = getBeatenHandDescription(gameState, winners);

    return (winners ?? []).map(w => {
        if (w.winType === "showdown" && w.description) {
            const over = beaten ? ` over ${beaten}` : "";
            return `Seat ${w.seat} won with ${w.description}${over} — ${w.formattedAmount}`;
        }
        return `Seat ${w.seat} wins ${w.formattedAmount} (uncontested)`;
    });
};
