import React, { createContext, useContext } from "react";
import { useHoleCardDeal, type HoleCardDealState } from "../hooks/animations/useHoleCardDeal";

/**
 * HoleCardDealContext — one shared instance of the dealing choreography (ui#21).
 *
 * `useHoleCardDeal` owns timers and acks the bus, so it must run exactly once
 * per table. The three consumers — `DealingLayer` (the flying card backs) and
 * the `Player` / `OppositePlayer` seats (which hold their placeholder until
 * their cards land) — read that single instance through this context.
 *
 * Mounted by `Table` around the table div, inside `GameEventsProvider` (the
 * committed bus item) and `GameSettingsProvider` (the on/off toggle).
 */
const HoleCardDealContext = createContext<HoleCardDealState | null>(null);

export const HoleCardDealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value = useHoleCardDeal();
    return <HoleCardDealContext.Provider value={value}>{children}</HoleCardDealContext.Provider>;
};

export const useHoleCardDealContext = (): HoleCardDealState => {
    const context = useContext(HoleCardDealContext);
    if (!context) {
        throw new Error("useHoleCardDealContext must be used within a HoleCardDealProvider");
    }
    return context;
};
