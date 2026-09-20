/**
 * holeCardDeal decorator (ui#21 — docs/plans/2026_09_20_hole_card_dealing_animation.md).
 *
 * When a commit carries a `cardsDealt` event, attach a `dealHoleCards` animation
 * hint listing the dealt seats in DEALING ORDER — clockwise from the seat after
 * the button, wrapping — with the per-card stagger. The render consumer
 * (useHoleCardDeal) flies a card back from the deck to each seat in two rounds,
 * then flips the viewer's pair.
 *
 * Like communityCardStagger it sets no `minDisplayMs`/`holdPreviousMs`: the hint
 * opts into an ANIMATION ACK (§2.7) whose budget is computed from the ACTUAL seat
 * count (heads-up is not budgeted like 9-max). The consumer acks when the flip
 * finishes; a missing ack (unmounted, setting off, hidden tab) falls back to the
 * budget so the drain can never stall.
 *
 * The engine hands the deck out in seat order, but the cards are face-down, so
 * the visual order is free to follow the felt — the issue's "first active player
 * left of the dealer".
 *
 * Pure function; unit-tested in isolation.
 */
import type { Decorator, Decoration, AnimationHint } from "../types";
import { hasElements } from "../../utils/guards";
import { HOLE_CARD_STAGGER_MS, holeCardDealAckTimeoutMs } from "../timing";

/** The `AnimationHint.kind` this decorator attaches and useHoleCardDeal consumes. */
export const DEAL_HOLE_CARDS_KIND = "dealHoleCards";

/**
 * Order dealt seats clockwise from the seat after the button: every seat above
 * the button in ascending order, then the seats from 1 up to and including the
 * button. Without a button (`null`) the order is simply ascending.
 */
export function dealingOrder(seats: readonly number[], dealerSeat: number | null): number[] {
    const ascending = [...seats].sort((a, b) => a - b);
    if (dealerSeat === null) {
        return ascending;
    }
    const afterButton = ascending.filter(seat => seat > dealerSeat);
    const upToButton = ascending.filter(seat => seat <= dealerSeat);
    return [...afterButton, ...upToButton];
}

export const holeCardDeal: Decorator = (item): Partial<Decoration> => {
    const animations: AnimationHint[] = [];
    for (const event of item.events) {
        if (event.type === "cardsDealt" && hasElements(event.seats)) {
            const seats = dealingOrder(event.seats, event.dealerSeat);
            animations.push({
                kind: DEAL_HOLE_CARDS_KIND,
                seats,
                staggerMs: HOLE_CARD_STAGGER_MS,
                // Opt into a drain-gating ack (ackId is stamped by the bus).
                ackTimeoutMs: holeCardDealAckTimeoutMs(seats.length)
            });
        }
    }
    return hasElements(animations) ? { animations } : {};
};
