/**
 * communityCardStagger decorator (WS Action Bus, Phase 3 — plan §2.4).
 *
 * When a commit advances the street AND deals new community cards
 * (`roundAdvanced` with a non-empty `newCommunityCards`), attach a `dealCards`
 * animation hint carrying the newly-dealt cards, the street, and the per-card
 * stagger. This replaces the hard-coded 1000/1100/1200ms timers in
 * useCardAnimations, and crucially fires on EVERY street (flop, turn, river) —
 * fixing the old "flop only, never turn/river" bug — because it keys off the
 * derived event, not a `communityCards.length >= 3` boolean.
 *
 * It sets no `minDisplayMs`/`holdPreviousMs` — normal betting flow is never slowed
 * by a fixed guess. Instead the hint opts into an ANIMATION ACK (Phase 5, §2.7):
 * it declares `ackTimeoutMs`, and the render consumer (useCardAnimations) calls
 * `bus.ackAnimation` when the last staggered flip completes. The drain then holds
 * the next commit exactly as long as the reveal actually takes, bounded by the
 * timeout so a missing ack (component unmounted / not rendered) can never stall.
 *
 * Pure function; unit-tested in isolation.
 */
import type { Decorator, Decoration, AnimationHint } from "../types";
import { hasElements } from "../../utils/guards";
import { CARD_STAGGER_MS, DEAL_CARDS_ACK_TIMEOUT_MS } from "../timing";

// The durations live in ../timing (one source for the bus, the hooks and the
// CSS); re-exported here so existing importers of this decorator keep working.
export { CARD_STAGGER_MS, MAX_STREET_CARDS, CARD_DROP_MS, ACK_MARGIN_MS, DEAL_CARDS_ACK_TIMEOUT_MS } from "../timing";

export const communityCardStagger: Decorator = (item): Partial<Decoration> => {
    const animations: AnimationHint[] = [];
    for (const event of item.events) {
        if (event.type === "roundAdvanced" && hasElements(event.newCommunityCards)) {
            animations.push({
                kind: "dealCards",
                staggerMs: CARD_STAGGER_MS,
                cards: event.newCommunityCards,
                round: event.to,
                // Opt into a drain-gating ack (ackId is stamped by the bus).
                ackTimeoutMs: DEAL_CARDS_ACK_TIMEOUT_MS
            });
        }
    }
    return hasElements(animations) ? { animations } : {};
};
