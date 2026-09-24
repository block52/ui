import { useCallback, useEffect, useState } from "react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { useGameStateContext } from "../../context/GameStateContext";
import { useActionSubmit } from "../../context/ActionSubmitContext";
import { findUserSeat } from "../../utils/playerSeatUtils";
import { getCosmosAddressSync } from "../../utils/cosmosAccountUtils";
import { sitOut } from "./sitOut";
import { useAutoSitOutNextBB } from "./useAutoSitOutNextBB";

export interface SitOutControls {
    /** "Sit Out Next Hand" checkbox state (server-backed, optimistic on toggle). */
    nextHandChecked: boolean;
    toggleNextHand: () => void;
    /** "Sit Out Next Big Blind" checkbox state (browser-only intent, #114). */
    nextBbQueued: boolean;
    toggleNextBb: () => void;
}

/**
 * Owns the sit-out toggle state and submission for BOTH renderers of the sit-out
 * controls (the desktop/landscape floating panel in PlayerActionButtons and the
 * compact-mobile hamburger row in MobileTableHeader — ui#670). The auto-sit-out
 * hook lives here so it stays mounted with the controls' owner regardless of
 * which surface renders the checkboxes.
 *
 * Both toggles route through the shared ActionSubmitController (dedupe, serialize,
 * confirm-on-chain, toast on failure) exactly as before — moving the presentation
 * must not duplicate submissions or stop automatic progression (ui#670 AC).
 */
export const useSitOutControls = (
    tableId: string | undefined,
    currentNetwork: NetworkEndpoints,
    pendingSitOut: string | null,
    // When false, the controls still track state but the auto-sit-out-on-BB
    // effect is inert — so a second, non-rendering instance (e.g. the off-compact
    // PlayerActionButtons while the compact drawer owns the live one) cannot fire
    // the SIT_OUT twice. Exactly one enabled instance is mounted per viewport.
    enabled = true
): SitOutControls => {
    const { gameState } = useGameStateContext();
    const { submit } = useActionSubmit();

    // Optimistic local state for immediate visual feedback; cleared when the
    // server's pendingSitOut arrives (or changes).
    const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null);

    // Browser-only intent for "Sit Out Next Big Blind" (#114). No chain state:
    // the hook below fires a standard SIT_OUT(next-hand) when bigBlindPosition
    // rotates onto our seat, then this flag is cleared so the box unchecks.
    const [nextBbQueued, setNextBbQueued] = useState<boolean>(false);

    const serverChecked = pendingSitOut === "next-hand";
    useEffect(() => {
        setOptimisticChecked(null);
    }, [pendingSitOut]);

    const nextHandChecked = optimisticChecked ?? serverChecked;

    const toggleNextHand = useCallback(() => {
        setOptimisticChecked(!nextHandChecked);
        if (tableId) {
            submit({ actionName: "sit-out", run: () => sitOut(tableId, currentNetwork) });
        }
    }, [nextHandChecked, tableId, currentNetwork, submit]);

    const toggleNextBb = useCallback(() => {
        setNextBbQueued(prev => !prev);
    }, []);

    // When the BB rotates onto our seat, fire the standard SIT_OUT(next-hand)
    // through the ActionSubmitController — same path as the manual toggle above,
    // so the two dedupe/serialize instead of racing into a sequence mismatch
    // (ui#567). Clear the box optimistically once fired.
    const handleAutoSitOutNextBb = useCallback(() => {
        if (tableId) {
            submit({ actionName: "sit-out", run: () => sitOut(tableId, currentNetwork) });
        }
        setNextBbQueued(false);
    }, [tableId, currentNetwork, submit]);

    useAutoSitOutNextBB(findUserSeat(gameState, getCosmosAddressSync()), gameState?.bigBlindPosition, enabled && nextBbQueued, handleAutoSitOutNextBb);

    return { nextHandChecked, toggleNextHand, nextBbQueued, toggleNextBb };
};
