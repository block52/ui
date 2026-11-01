import { useCallback, useMemo } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { useActionSubmit } from "../../context/ActionSubmitContext";
import { useNetwork } from "../../context/NetworkContext";
import { isConnectionLive } from "../../context/gameState/connection";
import { usePlayerLegalActions } from "./usePlayerLegalActions";
import { usePlayerTimer } from "../player/usePlayerTimer";
import { getActionFlags, getUserPlayer, timeBankButtonSeconds, timeBankClockState, TimeBankClockState } from "../../utils/pockerActionUtils";
import { nextTimeBankMs } from "../../utils/turnClock";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { timeBank } from "./timeBank";

export interface TimeBankClock {
    state: TimeBankClockState;
    /** What a tap grants now: whatever is left in the bank (ui#944); null when it can't be tapped. */
    seconds: number | null;
    /** Arms the time bank; a no-op unless the state is `ready`. */
    onUse: () => void;
}

/**
 * The alarm-clock time bank button on the player's own pill (ui#19).
 *
 * Tapping it submits the engine's `time-bank` action through the shared
 * ActionSubmitController. The chain adds the bank AFTER the turn clock, so the
 * turn clock keeps counting down (the button glows, `armed`) and the countdown
 * switches to the bank only when it runs out (`running`, see turnClockPhase).
 *
 * @param tableId The table (game ID on Cosmos)
 * @param seat The player's own seat
 */
export const useTimeBankClock = (tableId: string | undefined, seat: number): TimeBankClock => {
    const { gameState, connection } = useGameStateContext();
    const { legalActions, isPlayerTurn } = usePlayerLegalActions();
    const { submit, loadingAction } = useActionSubmit();
    const { currentNetwork } = useNetwork();
    const { isTimeBankArmed = false, isInTimeBank = false } = usePlayerTimer(tableId, seat);

    const userPlayer = useMemo(
        () => getUserPlayer(gameState?.players ?? null, localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase()),
        [gameState?.players]
    );
    const { hasTimeBankAction } = getActionFlags(legalActions);
    const isUsersTurn = isPlayerTurn && isConnectionLive(connection);
    const seconds = timeBankButtonSeconds({ hasTimeBankAction, isUsersTurn, timeBankMs: nextTimeBankMs(userPlayer) });

    const state = timeBankClockState({
        tableHasTimeBank: (gameState?.gameOptions?.timeBankMs ?? 0) > 0,
        timeBankSeconds: seconds,
        isSubmitting: loadingAction === NonPlayerActionType.TIME_BANK,
        isArmed: isTimeBankArmed,
        isInTimeBank
    });

    const onUse = useCallback(() => {
        if (state !== "ready" || !tableId) {
            return;
        }
        submit({ actionName: NonPlayerActionType.TIME_BANK, run: () => timeBank(tableId, currentNetwork) });
    }, [state, tableId, submit, currentNetwork]);

    return { state, seconds, onUse };
};
