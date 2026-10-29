import React, { createContext, useContext, useMemo } from "react";
import type { GameStreamItem } from "../../bus/types";

/**
 * GameEventsContext — the latest committed bus item (WS Action Bus, Phase 2).
 *
 * Holds the most recently committed {@link GameStreamItem}, whose `events` array
 * carries the typed transitions derived at ingest ({@link deriveEvents}).
 * Consumers read it through `useGameEvents` (src/hooks/game/useGameEvents.ts)
 * instead of hand-rolling `useRef` snapshot diffing.
 *
 * A dedicated slice (like the other five in this folder) so only event
 * consumers re-render when a new item commits — the hot GameDataContext is
 * untouched.
 */
interface GameEventsContextValue {
    /** The latest committed stream item, or null before the first commit. */
    latestItem: GameStreamItem | null;
    /**
     * Resolve a bus animation ack (Phase 5, §2.7). The render layer calls this
     * (via {@link useAnimationAck}) when an ack-bearing hint's choreography
     * finishes, so the drain commits the next item as soon as the animation is
     * actually done rather than after a fixed guess. Stable identity.
     */
    ackAnimation: (ackId: string) => void;
    /**
     * Is a protected tournament run-out (ui#873) still queued or holding the
     * rendered track? Read imperatively (it changes on timers, not commits) by
     * useAutoNewHand to defer the next hand's deal. Stable identity.
     */
    isPlayingSuspense: () => boolean;
}

const GameEventsContext = createContext<GameEventsContextValue | null>(null);

interface GameEventsProviderProps {
    latestItem: GameStreamItem | null;
    ackAnimation: (ackId: string) => void;
    isPlayingSuspense: () => boolean;
    children: React.ReactNode;
}

export const GameEventsProvider: React.FC<GameEventsProviderProps> = ({ latestItem, ackAnimation, isPlayingSuspense, children }) => {
    const value = useMemo<GameEventsContextValue>(() => ({ latestItem, ackAnimation, isPlayingSuspense }), [latestItem, ackAnimation, isPlayingSuspense]);
    return <GameEventsContext.Provider value={value}>{children}</GameEventsContext.Provider>;
};

export const useGameEventsContext = (): GameEventsContextValue => {
    const context = useContext(GameEventsContext);
    if (!context) {
        throw new Error("useGameEventsContext must be used within a GameEventsProvider");
    }
    return context;
};
