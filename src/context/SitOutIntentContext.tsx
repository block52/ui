/**
 * Sit-out intent (#684).
 *
 * "Sit Out Next Hand" and "Sit Out Next Big Blind" are queued intents, not
 * immediate actions, and they are now offered in TWO places: the desktop panel
 * on the felt (PlayerActionButtons) and the phone's hamburger drawer
 * (MobileTableHeader). Those are siblings, so the state has to live above both
 * or the two copies drift — one showing ticked while the other shows clear.
 *
 * It also has to be mounted ONCE: `useAutoSitOutNextBB` fires a real SIT_OUT
 * when the big blind reaches our seat, and two mounted copies would submit it
 * twice.
 */
import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NonPlayerActionType, type LegalActionDTO } from "@block52/poker-vm-sdk";
import { sitOut, useAutoSitOutNextBB } from "../hooks/playerActions";
import { useActionSubmit } from "./ActionSubmitContext";
import { useGameStateContext } from "./GameStateContext";
import { findUserSeat } from "../utils/playerSeatUtils";
import { getCosmosAddressSync } from "../utils/cosmosAccountUtils";
import type { NetworkEndpoints } from "./NetworkContext";

export interface SitOutIntent {
    /** "Sit Out Next Hand" — chain state (pendingSitOut), with an optimistic overlay. */
    nextHandChecked: boolean;
    toggleNextHand: () => void;
    /** "Sit Out Next Big Blind" — browser-only intent (#114); no chain state. */
    nextBbQueued: boolean;
    toggleNextBb: () => void;
    /** Whether the engine currently allows sitting out. */
    canSitOut: boolean;
}

const noop = (): void => {};
const SitOutIntentContext = createContext<SitOutIntent>({
    nextHandChecked: false,
    toggleNextHand: noop,
    nextBbQueued: false,
    toggleNextBb: noop,
    canSitOut: false
});

export const SitOutIntentProvider: React.FC<{
    tableId?: string;
    network: NetworkEndpoints;
    pendingSitOut: string | null;
    legalActions: LegalActionDTO[];
    children: ReactNode;
}> = ({ tableId, network, pendingSitOut, legalActions, children }) => {
    const { submit } = useActionSubmit();
    const { gameState } = useGameStateContext();

    // Optimistic overlay so the box responds to the tap, cleared when the chain
    // reports the new pendingSitOut.
    const [optimistic, setOptimistic] = useState<boolean | null>(null);
    const serverChecked = pendingSitOut === "next-hand";
    useEffect(() => setOptimistic(null), [pendingSitOut]);
    const nextHandChecked = optimistic ?? serverChecked;

    const [nextBbQueued, setNextBbQueued] = useState<boolean>(false);

    const submitSitOut = useCallback(() => {
        if (tableId) {
            // Through the shared controller so it dedupes and serializes with
            // every other action from this account (ui#567/#635).
            submit({ actionName: "sit-out", run: () => sitOut(tableId, network) });
        }
    }, [tableId, network, submit]);

    const toggleNextHand = useCallback(() => {
        setOptimistic(prev => !(prev ?? serverChecked));
        submitSitOut();
    }, [serverChecked, submitSitOut]);

    const toggleNextBb = useCallback(() => setNextBbQueued(prev => !prev), []);

    // Fires the standard SIT_OUT(next-hand) when the BB rotates onto our seat,
    // then clears the box. Mounted here so it runs exactly once.
    const handleAutoSitOutNextBb = useCallback(() => {
        submitSitOut();
        setNextBbQueued(false);
    }, [submitSitOut]);

    useAutoSitOutNextBB(findUserSeat(gameState, getCosmosAddressSync()), gameState?.bigBlindPosition, nextBbQueued, handleAutoSitOutNextBb);

    const canSitOut = legalActions.some(a => a.action === NonPlayerActionType.SIT_OUT);

    return (
        <SitOutIntentContext.Provider value={{ nextHandChecked, toggleNextHand, nextBbQueued, toggleNextBb, canSitOut }}>
            {children}
        </SitOutIntentContext.Provider>
    );
};

export const useSitOutIntent = (): SitOutIntent => useContext(SitOutIntentContext);
