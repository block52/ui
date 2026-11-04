import { useCallback, useEffect, useRef } from "react";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import type { AnimationHint } from "../../bus/types";
import { hasValue } from "../../utils/guards";

/**
 * useAnimationAck — bridge bus animation acks to React consumers (Phase 5, §2.7).
 *
 * Given the ack-bearing hints of the latest committed item, returns a
 * `done(ackId)` callback the animating component invokes when that hint's
 * choreography finishes. The drain then commits the next item as soon as every
 * ack of the current item has resolved (or its `ackTimeoutMs` fired), instead of
 * the bus guessing the animation's total duration.
 *
 * Contract:
 *   - Idempotent per `ackId`: a second `done(ackId)` is a no-op (the id has been
 *     acked already; the bus would treat it as a late no-op anyway, but we short-
 *     circuit so consumers can call it liberally). The idempotency set resets when
 *     the committed hints change, so a new commit's ids are always ackable.
 *   - Unmount-safe by construction: this hook schedules no timers of its own, so
 *     there is nothing to leak. If the consuming component unmounts mid-animation
 *     and never calls `done`, the bus's `ackTimeoutMs` is the backstop — the drain
 *     falls back to a fixed wait (worst case = the pre-ack behavior). Any timers
 *     the CONSUMER schedules to decide when to ack are the consumer's to clean up.
 *
 * @param hints the latest committed item's animation hints (ack-bearing or not).
 * @returns `done(ackId)` — resolve the ack for the given hint.
 */
export function useAnimationAck(hints: AnimationHint[]): (ackId: string) => void {
    const { ackAnimation } = useGameEventsContext();
    const ackedRef = useRef<Set<string>>(new Set());

    // Reset the idempotency set whenever the committed ack ids change (a new
    // commit). Keeps the set bounded and lets each commit's ids be acked once.
    const ackKey = hints
        .map(hint => hint.ackId)
        .filter((id): id is string => hasValue(id))
        .join(",");
    useEffect(() => {
        ackedRef.current = new Set();
    }, [ackKey]);

    return useCallback(
        (ackId: string) => {
            if (ackedRef.current.has(ackId)) {
                return;
            }
            ackedRef.current.add(ackId);
            ackAnimation(ackId);
        },
        [ackAnimation]
    );
}
