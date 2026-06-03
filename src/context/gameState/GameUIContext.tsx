import React, { createContext, useContext, useMemo } from "react";
import type { ValidationError } from "../../components/playPage/TableErrorPage";

/**
 * GameUIContext — holds interaction-driven UI state (loading, errors).
 *
 * Updated on user action, subscribe lifecycle, and connection-level errors.
 * Splitting this out means components that only render game data don't
 * re-render when isLoading flips.
 */
interface GameUIContextValue {
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
}

const GameUIContext = createContext<GameUIContextValue | null>(null);

interface GameUIProviderProps extends GameUIContextValue {
    children: React.ReactNode;
}

export const GameUIProvider: React.FC<GameUIProviderProps> = ({
    isLoading,
    error,
    validationError,
    children
}) => {
    const value = useMemo<GameUIContextValue>(
        () => ({ isLoading, error, validationError }),
        [isLoading, error, validationError]
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
