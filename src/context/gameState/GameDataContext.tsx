import React, { createContext, useContext, useMemo } from "react";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

/**
 * GameDataContext — holds the live TexasHoldemStateDTO only.
 *
 * Updated on every WebSocket message. Hooks that only need game state
 * (player chips, board cards, turn index, etc.) should consume this
 * instead of the omnibus useGameStateContext().
 */
interface GameDataContextValue {
    gameState: TexasHoldemStateDTO | undefined;
    /**
     * Provenance of the snapshot above (ui#659): `true` when it came from the
     * relay's `optimistic` event — a projection of pending mempool actions
     * rather than committed chain state.
     *
     * The render track deliberately shows optimistic frames, because seeing
     * your own action land instantly is the point. But a value that is NOT a
     * consequence of the pending action — the tournament's payout structure,
     * say — must not be re-read from a projection, or it flickers between the
     * two producers' answers. Read this before rendering anything whose
     * entitlement did not change.
     */
    isOptimistic: boolean;
}

const GameDataContext = createContext<GameDataContextValue | null>(null);

interface GameDataProviderProps {
    gameState: TexasHoldemStateDTO | undefined;
    isOptimistic: boolean;
    children: React.ReactNode;
}

export const GameDataProvider: React.FC<GameDataProviderProps> = ({ gameState, isOptimistic, children }) => {
    const value = useMemo<GameDataContextValue>(() => ({ gameState, isOptimistic }), [gameState, isOptimistic]);
    return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

export const useGameData = (): GameDataContextValue => {
    const context = useContext(GameDataContext);
    if (!context) {
        throw new Error("useGameData must be used within a GameDataProvider");
    }
    return context;
};
