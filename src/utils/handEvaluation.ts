/**
 * Client-side hand evaluation for the hand-strength display and the showdown
 * summary, aware of the table's variant (ui#768).
 *
 * Hold'em takes the best five of hole + board. Omaha must use EXACTLY two of
 * the four hole cards and exactly three of the board, so the Hold'em path would
 * overstate an Omaha hand (four suited hole cards are not a flush). The chain's
 * engine applies the same rule at showdown; this mirrors it for display only.
 */

import { Deck, GameVariant, HandEvaluation, PokerGameIntegration, PokerSolver } from "@block52/poker-vm-sdk";

export interface EvaluatedHand {
    description: string;
    /** SDK hand-type rank — higher is a stronger hand class. */
    score: number;
    /** The cards that make the hand, as mnemonics. */
    hand: string[];
}

const combinations = <T>(items: T[], k: number): T[][] => {
    if (k === 0) return [[]];
    if (items.length < k) return [];
    const [first, ...rest] = items;
    return [...combinations(rest, k - 1).map(c => [first, ...c]), ...combinations(rest, k)];
};

const toEvaluated = (evaluation: HandEvaluation, cardCount: number, board: string[]): EvaluatedHand => {
    const hand = evaluation.bestHand.map(card => card.mnemonic || card.toString());
    // Preflop (two cards) has its own short description ("Pocket Aces"). From
    // the flop on, a five-card hand gets the same words as the winner on the
    // seat (poker-vm#2721): the board tells "Set of Sevens" from "Trip Sevens".
    let description: string;
    if (cardCount === 2) description = evaluation.description;
    else if (hand.length === 5) description = PokerGameIntegration.describeWinningHand(hand, board);
    else description = PokerGameIntegration.formatHandDescription(evaluation);
    return {
        description,
        score: evaluation.handType,
        hand
    };
};

/**
 * Best Omaha hand from 4 hole cards and 0–5 board cards. Before the flop there
 * is no board to take three from, so the hand is the best hole-card pair.
 */
const evaluateOmaha = (holeCards: string[], board: string[]): EvaluatedHand => {
    const holePairs = combinations(holeCards, 2);
    const boardTriples = board.length >= 3 ? combinations(board, 3) : [[]];

    let best: HandEvaluation | null = null;
    let bestCount = 0;
    for (const pair of holePairs) {
        for (const triple of boardTriples) {
            const cards = [...pair, ...triple];
            const evaluation = PokerSolver.evaluatePartialHand(cards.map(c => Deck.fromString(c)));
            if (!best || PokerSolver.compareHands(evaluation, best) > 0) {
                best = evaluation;
                bestCount = cards.length;
            }
        }
    }
    if (!best) throw new Error("no Omaha hand to evaluate");
    return toEvaluated(best, bestCount, board);
};

/**
 * Evaluate hole cards + board for the given variant. Returns null when there
 * are fewer than two hole cards; throws when a card doesn't parse.
 */
export const evaluateHandOrThrow = (
    holeCards: string[] | undefined | null,
    board: string[],
    variant: GameVariant | string | undefined
): EvaluatedHand | null => {
    if (!holeCards || holeCards.length < 2) return null;
    if (variant === GameVariant.OMAHA && holeCards.length === 4) {
        return evaluateOmaha(holeCards, board);
    }
    const allCards = [...holeCards, ...board];
    const evaluation = PokerSolver.evaluatePartialHand(allCards.map(c => Deck.fromString(c)));
    return toEvaluated(evaluation, allCards.length, board);
};

/**
 * As {@link evaluateHandOrThrow}, but null when the cards are masked ("X"
 * placeholders don't parse) — for opponents' hands, where that is expected.
 */
export const evaluateHand = (
    holeCards: string[] | undefined | null,
    board: string[],
    variant: GameVariant | string | undefined
): EvaluatedHand | null => {
    try {
        return evaluateHandOrThrow(holeCards, board, variant);
    } catch {
        return null;
    }
};
