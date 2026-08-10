import { useCallback } from "react";
import { useGameActions } from "../../context/gameState/GameActionsContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { useNetwork } from "../../context/NetworkContext";
import { executeTransportAction } from "./transportAction";
import type { PlayerActionResult } from "../../types";
import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";
import { isNullish, hasValue } from "../../utils/guards";

/**
 * Actions that can be performed optimistically.
 * Uses SDK enums for type safety.
 */
export const OptimisticAction = {
    // Player actions (from PlayerActionType)
    FOLD: PlayerActionType.FOLD,
    CHECK: PlayerActionType.CHECK,
    BET: PlayerActionType.BET,
    CALL: PlayerActionType.CALL,
    RAISE: PlayerActionType.RAISE,
    MUCK: PlayerActionType.MUCK,
    SHOW: PlayerActionType.SHOW,
    // Non-player actions (from NonPlayerActionType)
    SIT_IN: NonPlayerActionType.SIT_IN,
    SIT_OUT: NonPlayerActionType.SIT_OUT,
} as const;

export type OptimisticActionType = typeof OptimisticAction[keyof typeof OptimisticAction];

/**
 * Actions that require an amount parameter
 */
const ACTIONS_REQUIRING_AMOUNT: Set<OptimisticActionType> = new Set([
    OptimisticAction.BET,
    OptimisticAction.CALL,
    OptimisticAction.RAISE,
]);

interface UseOptimisticActionReturn {
    performOptimisticAction: (
        tableId: string,
        action: OptimisticActionType,
        amount?: bigint
    ) => Promise<PlayerActionResult>;
    isPending: boolean;
}

/**
 * Hook that wraps player actions with optimistic updates.
 *
 * This hook:
 * 1. Sends the action via WebSocket for immediate broadcast to all subscribers
 * 2. Executes the actual blockchain transaction via SDK
 * 3. The WebSocket server will broadcast "pending" state immediately
 * 4. When the block confirms, the server broadcasts "confirmed" state
 *
 * Usage:
 *   const { performOptimisticAction } = useOptimisticAction();
 *   await performOptimisticAction(tableId, OptimisticAction.FOLD);
 *   await performOptimisticAction(tableId, OptimisticAction.RAISE, 100n);
 */
export function useOptimisticAction(): UseOptimisticActionReturn {
    const { sendAction } = useGameActions();
    const { pendingAction } = useGameUI();
    const { currentNetwork } = useNetwork();

    const performOptimisticAction = useCallback(
        async (
            tableId: string,
            action: OptimisticActionType,
            amount?: bigint
        ): Promise<PlayerActionResult> => {

            // Validate amount for actions that require it
            if (ACTIONS_REQUIRING_AMOUNT.has(action) && isNullish(amount)) {
                throw new Error(`Amount required for ${action}`);
            }

            // Announce via WS first (best-effort latency optimization for
            // other subscribers); the chain broadcast is the validated state.
            try {
                await sendAction(action, amount?.toString());
            } catch {
                // intentional: WS broadcast is best-effort
            }

            // Chain-direct executor: SDK performActionSync.
            return executeTransportAction(tableId, action, amount ?? 0n, currentNetwork);
        },
        [sendAction, currentNetwork]
    );

    return {
        performOptimisticAction,
        isPending: hasValue(pendingAction)
    };
}
