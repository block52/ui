import { useMemo } from "react";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import type { GameEvent, GameEventType } from "../../bus/types";
import { isNullish } from "../../utils/guards";

/**
 * useGameEvents — the events of the latest committed bus item (WS Action Bus,
 * Phase 2).
 *
 * Returns the typed transitions ({@link GameEvent}) derived at ingest for the
 * most recent commit, optionally narrowed to a single event type. This replaces
 * the per-consumer `useRef` snapshot diffing (sounds, badges, animations) with
 * one shared, unit-tested source (plan §1.2, Commandment 12).
 *
 * The returned array changes identity on every commit (a fresh item object), so
 * an effect keyed on it fires once per commit — a duplicate frame derives zero
 * events, so no effect re-fires spuriously, and the first frame after
 * subscribe/reset carries no events (no history replay).
 *
 * @param filter - optional event type to keep; omit for all events.
 * @returns the (optionally filtered) events of the latest commit. When filtered,
 *   the element type is narrowed to the matching variant.
 */
export function useGameEvents(): GameEvent[];
export function useGameEvents<T extends GameEventType>(filter: T): Extract<GameEvent, { type: T }>[];
export function useGameEvents(filter?: GameEventType): GameEvent[] {
    const { latestItem } = useGameEventsContext();
    const events = latestItem?.events;

    return useMemo(() => {
        if (!events) {
            return [];
        }
        if (isNullish(filter)) {
            return events;
        }
        return events.filter(event => event.type === filter);
    }, [events, filter]);
}
