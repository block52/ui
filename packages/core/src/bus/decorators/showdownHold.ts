/**
 * showdownHold decorator (WS Action Bus, Phase 3 — plan §2.4).
 *
 * When a commit carries a `handEnded` event, hold that snapshot on the RENDERED
 * track for {@link SHOWDOWN_HOLD_MS} before the drain commits whatever follows it
 * (the next hand). This absorbs the ui#443 showdown-hold hack into the pipeline:
 * the gateway can stream the next hand ~150ms after a showdown, and without this
 * the winner banner would flash and vanish.
 *
 * It sets `minDisplayMs` (hold AFTER this commit) rather than `holdPreviousMs`
 * because the snapshot to keep visible IS the handEnded snapshot — we commit it
 * immediately, then keep it up.
 *
 * Pure function; unit-tested in isolation.
 */
import type { Decorator, Decoration } from "../types";

/** How long a showdown stays visible before the next hand commits (ui#443). */
export const SHOWDOWN_HOLD_MS = 2000;

export const showdownHold: Decorator = (item): Partial<Decoration> => {
    const hasHandEnded = item.events.some(event => event.type === "handEnded");
    if (!hasHandEnded) {
        return {};
    }
    return { minDisplayMs: SHOWDOWN_HOLD_MS };
};
