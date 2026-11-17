/**
 * coalesceCatchUp decorator (WS Action Bus, Phase 3 — plan §2.4 / §2.6).
 *
 * Marks a state item `coalescible` — i.e. droppable by the drain when the queue
 * is under backpressure (a reconnect catch-up burst, or a fast heads-up game
 * outrunning a showdown hold). The DECORATOR only classifies; the actual dropping
 * happens in GameMessageBus.coalesce(), and only when the depth/hold caps are
 * exceeded (§2.6). Marking it here is a standing permission, not an instruction.
 *
 * Coalescibility rule (design choice — plan §2.4 offered "classify in the
 * decorator OR in the drain"; we classify HERE so the rule is one pure, tested
 * function): a state item is coalescible iff it carries NEITHER a `handEnded` nor
 * a `handStarted` event. Those two are hand-boundary frames:
 *   - `handEnded` must never be dropped — the player has to see every showdown;
 *   - `handStarted` is not an "intermediate state within a round" (§2.6), and
 *     dropping it would skip the visual start of a hand.
 * Everything else (playerActed, roundAdvanced, stack/card changes) is an
 * intermediate frame the newest snapshot supersedes, so it may be coalesced away
 * while the final state still converges.
 *
 * Non-state items never reach the paced queue, so this only runs meaningfully for
 * `kind === "state"`.
 *
 * Pure function; unit-tested in isolation.
 */
import type { Decorator, Decoration } from "../types";

export const coalesceCatchUp: Decorator = (item): Partial<Decoration> => {
    if (item.kind !== "state") {
        return {};
    }
    const isHandBoundary = item.events.some(event => event.type === "handEnded" || event.type === "handStarted");
    return { coalescible: !isHandBoundary };
};
