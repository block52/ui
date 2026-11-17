/**
 * actionBadge decorator (WS Action Bus, Phase 3 — plan §2.4).
 *
 * For every `playerActed` event on a commit, attach an `actionBadge` animation
 * hint tagged with the acting seat. It is the decoration-level marker that "seat
 * N just did something," used by the drop-box / Badge action-banner path.
 *
 * The migrated consumers (usePlayerActionDropBox) read the `playerActed` EVENTS
 * directly (which are derived on both the bus and the direct/off path), so this
 * hint is a lightweight, unit-tested companion rather than the sole signal — it
 * keeps the decoration self-describing and lets future render-layer code react
 * without re-scanning events.
 *
 * Pure function; unit-tested in isolation.
 */
import type { Decorator, Decoration, AnimationHint } from "../types";
import { hasElements } from "../../utils/guards";

export const actionBadge: Decorator = (item): Partial<Decoration> => {
    const animations: AnimationHint[] = [];
    for (const event of item.events) {
        if (event.type === "playerActed") {
            animations.push({ kind: "actionBadge", seat: event.action.seat });
        }
    }
    return hasElements(animations) ? { animations } : {};
};
