import { useCallback } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useNetwork, NetworkEndpoints } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";
import type { PlayerActionResult } from "../../types";
import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";

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
 * Execute a poker action on the Cosmos blockchain.
 *
 * Uses the SDK's performActionSync method (CheckTx-only, returns in
 * ~50-100ms) rather than performAction (waits for block inclusion,
 * ~5s with current chain config). The authoritative state arrives
 * via the WebSocket push once the block commits; the SDK throws here
 * only on CheckTx rejection (invalid signature, insufficient gas,
 * malformed message) — that's the immediate rollback signal.
 *
 * The "no WS confirmation within N seconds" timeout-based rollback
 * is a separate enhancement tracked as a follow-up on block52/ui#359.
 *
 * Refs: block52/ui#359, block52/poker-vm#2104.
 */
async function executeAction(
    tableId: string,
    action: OptimisticActionType,
    amount: bigint,
    network: NetworkEndpoints
): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);


    const transactionHash = await signingClient.performActionSync(
        tableId,
        action,
        amount
    );


    return {
        hash: transactionHash,
        gameId: tableId,
        action: action
    };
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
    const { sendAction, pendingAction } = useGameStateContext();
    const { currentNetwork } = useNetwork();

    const performOptimisticAction = useCallback(
        async (
            tableId: string,
            action: OptimisticActionType,
            amount?: bigint
        ): Promise<PlayerActionResult> => {

            // Validate amount for actions that require it
            if (ACTIONS_REQUIRING_AMOUNT.has(action) && amount === undefined) {
                throw new Error(`Amount required for ${action}`);
            }

            // Step 1: Send via WebSocket for immediate optimistic broadcast
            try {
                await sendAction(action, amount?.toString());
            } catch (wsError) {
                // WebSocket notification failed - continue with transaction anyway
            }

            // Step 2: Execute the blockchain transaction via SDK
            const result = await executeAction(
                tableId,
                action,
                amount ?? 0n,
                currentNetwork
            );

            return result;
        },
        [sendAction, currentNetwork]
    );

    return {
        performOptimisticAction,
        isPending: pendingAction !== null
    };
}
