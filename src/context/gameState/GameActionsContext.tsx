import React, { createContext, useContext, useMemo } from "react";
import type { KnownHoleCards } from "../../utils/replayCards";

/**
 * GameActionsContext — stable function references for table I/O.
 *
 * These callbacks are wrapped in useCallback at the source, so the value
 * reference is stable across renders. Components that only need to *send*
 * actions can subscribe here and never re-render on incoming WS state.
 */
export interface GameActionsContextValue {
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    /** actionIndex null = the hand's final state (showdown or last action). */
    loadHistoricalState: (tableId: string, handNumber: number, actionIndex: number | null) => Promise<void>;
    /** One step of a hand replay (ui#816): the public state at a block height. */
    loadHistoricalStateAtHeight: (tableId: string, handNumber: number, height: number, step: number | null, known?: KnownHoleCards) => Promise<void>;
}

const GameActionsContext = createContext<GameActionsContextValue | null>(null);

interface GameActionsProviderProps extends GameActionsContextValue {
    children: React.ReactNode;
}

export const GameActionsProvider: React.FC<GameActionsProviderProps> = ({
    subscribeToTable,
    unsubscribeFromTable,
    loadHistoricalState,
    loadHistoricalStateAtHeight,
    children
}) => {
    const value = useMemo<GameActionsContextValue>(
        () => ({ subscribeToTable, unsubscribeFromTable, loadHistoricalState, loadHistoricalStateAtHeight }),
        [subscribeToTable, unsubscribeFromTable, loadHistoricalState, loadHistoricalStateAtHeight]
    );
    return <GameActionsContext.Provider value={value}>{children}</GameActionsContext.Provider>;
};

export const useGameActions = (): GameActionsContextValue => {
    const context = useContext(GameActionsContext);
    if (!context) {
        throw new Error("useGameActions must be used within a GameActionsProvider");
    }
    return context;
};
