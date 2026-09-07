import React, { createContext, useContext, useMemo } from "react";
import type { GameFormat, GameVariant } from "@block52/poker-vm-sdk";

/**
 * GameMetaContext — holds format and variant.
 *
 * Set on table mount, never changes mid-hand. Splitting this out means
 * format/variant consumers don't re-render on every WS state update.
 */
interface GameMetaContextValue {
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    /** Optional ENS-style table name (poker-vm#337); undefined for unnamed tables. */
    gameName: string | undefined;
}

const GameMetaContext = createContext<GameMetaContextValue | null>(null);

interface GameMetaProviderProps {
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    gameName: string | undefined;
    children: React.ReactNode;
}

export const GameMetaProvider: React.FC<GameMetaProviderProps> = ({ gameFormat, gameVariant, gameName, children }) => {
    const value = useMemo<GameMetaContextValue>(
        () => ({ gameFormat, gameVariant, gameName }),
        [gameFormat, gameVariant, gameName]
    );
    return <GameMetaContext.Provider value={value}>{children}</GameMetaContext.Provider>;
};

export const useGameMeta = (): GameMetaContextValue => {
    const context = useContext(GameMetaContext);
    if (!context) {
        throw new Error("useGameMeta must be used within a GameMetaProvider");
    }
    return context;
};
