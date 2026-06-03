import React, { createContext, useContext, useMemo } from "react";

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
    loadHistoricalState: (tableId: string, handNumber: number, actionIndex: number) => Promise<void>;
}

const GameActionsContext = createContext<GameActionsContextValue | null>(null);

interface GameActionsProviderProps extends GameActionsContextValue {
    children: React.ReactNode;
}

export const GameActionsProvider: React.FC<GameActionsProviderProps> = ({
    subscribeToTable,
    unsubscribeFromTable,
    loadHistoricalState,
    children
}) => {
    const value = useMemo<GameActionsContextValue>(
        () => ({ subscribeToTable, unsubscribeFromTable, loadHistoricalState }),
        [subscribeToTable, unsubscribeFromTable, loadHistoricalState]
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
