import React, { createContext, useContext, useMemo } from "react";
import type { ValidationError } from "../../components/playPage/TableErrorPage";
import type { ConnectionState } from "./connection";

export interface PendingAction {
    gameId: string;
    actor: string;
    action: string;
    amount?: string;
    timestamp: number;
}

/**
 * GameUIContext — holds interaction-driven UI state (loading, errors, optimistic
 * action, connection freshness).
 *
 * Updated on user action, mempool acks, and connection-level changes. Splitting
 * this out means components that only render game data don't re-render when
 * pendingAction, isLoading or the connection status flips.
 */
interface GameUIContextValue {
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    /** Freshness of the live socket (ui#613). Only `live` means the table is current. */
    connection: ConnectionState;
}

const GameUIContext = createContext<GameUIContextValue | null>(null);

interface GameUIProviderProps extends GameUIContextValue {
    children: React.ReactNode;
}

export const GameUIProvider: React.FC<GameUIProviderProps> = ({
    isLoading,
    error,
    validationError,
    pendingAction,
    connection,
    children
}) => {
    const value = useMemo<GameUIContextValue>(
        () => ({ isLoading, error, validationError, pendingAction, connection }),
        [isLoading, error, validationError, pendingAction, connection]
    );
    return <GameUIContext.Provider value={value}>{children}</GameUIContext.Provider>;
};

export const useGameUI = (): GameUIContextValue => {
    const context = useContext(GameUIContext);
    if (!context) {
        throw new Error("useGameUI must be used within a GameUIProvider");
    }
    return context;
};
