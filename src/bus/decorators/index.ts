/**
 * Decorator registry (WS Action Bus, Phase 3).
 *
 * {@link buildDefaultDecorators} assembles the initial decorator set (plan §2.4)
 * in registration order. The DECORATION-MERGE RULE (see {@link Decorator}) is
 * commutative, so order is not load-bearing — but it is kept stable for readable
 * introspection. The bus calls this at construction when the caller does not pass
 * an explicit `decorators` list.
 */
import type { Decorator } from "../types";
import { showdownHold } from "./showdownHold";
import { communityCardStagger } from "./communityCardStagger";
import { actionBadge } from "./actionBadge";
import { makeRemoteActionSound } from "./remoteActionSound";
import { coalesceCatchUp } from "./coalesceCatchUp";
import { holeCardDeal } from "./holeCardDeal";

export { showdownHold, SHOWDOWN_HOLD_MS } from "./showdownHold";
export { communityCardStagger, CARD_STAGGER_MS, DEAL_CARDS_ACK_TIMEOUT_MS } from "./communityCardStagger";
export { actionBadge } from "./actionBadge";
export { makeRemoteActionSound } from "./remoteActionSound";
export { coalesceCatchUp } from "./coalesceCatchUp";
export { holeCardDeal, dealingOrder, DEAL_HOLE_CARDS_KIND } from "./holeCardDeal";

/**
 * @param getLocalAddress accessor for the local player's cosmos address, closed
 *   over by remoteActionSound so it can skip the local player's own echo.
 */
export function buildDefaultDecorators(getLocalAddress: () => string | null): Decorator[] {
    return [showdownHold, communityCardStagger, holeCardDeal, actionBadge, makeRemoteActionSound(getLocalAddress), coalesceCatchUp];
}
