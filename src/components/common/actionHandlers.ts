import {
    betHand,
    callHand,
    checkHand,
    dealCards,
    foldHand,
    muckCards,
    showCards,
    sitIn,
    SIT_IN_METHOD_POST_NOW,
    sitOut,
    SIT_OUT_METHOD_NEXT_HAND,
    startNewHand,
    postSmallBlind,
    postBigBlind,
    raiseHand
} from "../../hooks/playerActions";
import type { SitInMethod, SitOutMethod } from "../../hooks/playerActions";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";

/**
 * Optimistic WS broadcaster — the function returned by useGameActions().sendAction.
 *
 * Every click handler announces the action over the table's WebSocket *before*
 * submitting the real REST transaction. The announcement gives other clients
 * watching the same table a sub-100ms optimistic update; the REST submission
 * (~50–100ms CheckTx + ~5s commit) is the authoritative path.
 *
 * Failure of the WS announcement is non-fatal — we always proceed with the
 * REST submission so the user's action still goes through.
 */
export type OptimisticBroadcaster = (action: string, amount?: string) => Promise<void>;

/**
 * Fire-and-forget WS announcement. Swallows errors so a dead WebSocket
 * never blocks the real REST submission below it.
 */
function announce(send: OptimisticBroadcaster, action: string, amount?: string): void {
    send(action, amount).catch(err => {
        console.warn(`[actionHandlers] optimistic broadcast for ${action} failed:`, err);
    });
}

/**
 * Result type from player action functions
 */
interface ActionResult {
    hash?: string;
}

/**
 * Options for action handler factory
 */
interface ActionHandlerOptions {
    /** Log message on success (optional) */
    successLog?: string;
    /** Log message prefix for attempt (optional) */
    attemptLog?: string;
}

/**
 * Factory function to create simple action handlers (tableId, network) -> Promise<string | null>
 *
 * All handlers return Promise<string | null> where:
 * - string is the transaction hash on success
 * - null is returned on error or if tableId is missing
 */
function createSimpleHandler(
    actionName: string,
    wsAction: PlayerActionType | NonPlayerActionType,
    actionFn: (tableId: string, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        tableId: string | undefined,
        network: NetworkEndpoints,
        send: OptimisticBroadcaster
    ): Promise<string | null> => {
        if (!tableId) return null;

        announce(send, wsAction);

        try {
            const result = await actionFn(tableId, network);

            return result?.hash || null;
        } catch (error: any) {
            console.error(`Failed to ${actionName}:`, error);
            return null;
        }
    };
}

/**
 * Factory for handlers with signature: (amount, tableId, network) -> Promise<string | null>
 * Used for: handleCall, handleBet
 */
function createAmountFirstHandler(
    actionName: string,
    wsAction: PlayerActionType | NonPlayerActionType,
    actionFn: (tableId: string, amount: bigint, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        amount: bigint,
        tableId: string | undefined,
        network: NetworkEndpoints,
        send: OptimisticBroadcaster
    ): Promise<string | null> => {
        if (!tableId) return null;

        announce(send, wsAction, amount.toString());

        try {
            const result = await actionFn(tableId, amount, network);

            return result?.hash || null;
        } catch (error: any) {
            console.error(`Failed to ${actionName}:`, error);
            return null;
        }
    };
}

/**
 * Factory for handlers with signature: (tableId, amount, network) -> Promise<string | null>
 * Used for: handlePostSmallBlind, handlePostBigBlind, handleRaise
 */
function createTableIdAmountHandler(
    actionName: string,
    wsAction: PlayerActionType | NonPlayerActionType,
    actionFn: (tableId: string, amount: bigint, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        tableId: string | undefined,
        amount: bigint,
        network: NetworkEndpoints,
        send: OptimisticBroadcaster
    ): Promise<string | null> => {
        if (!tableId) return null;

        announce(send, wsAction, amount.toString());

        try {
            const result = await actionFn(tableId, amount, network);

            return result?.hash || null;
        } catch (error: any) {
            console.error(`Failed to ${actionName}:`, error);
            return null;
        }
    };
}

// =============================================================================
// Simple handlers (tableId, network) -> Promise<string | null>
// =============================================================================

const handleCheck = createSimpleHandler("check", PlayerActionType.CHECK, checkHand);

const handleFold = createSimpleHandler("fold", PlayerActionType.FOLD, foldHand);

const handleMuck = createSimpleHandler("muck cards", PlayerActionType.MUCK, muckCards);

const handleShow = createSimpleHandler("show cards", PlayerActionType.SHOW, showCards);

const handleDeal = createSimpleHandler("deal", NonPlayerActionType.DEAL, dealCards, {
    successLog: "Deal completed successfully"
});

const handleStartNewHand = createSimpleHandler("start new hand", NonPlayerActionType.NEW_HAND, startNewHand);

const handleSitOut = async (
    tableId: string | undefined,
    network: NetworkEndpoints,
    send: OptimisticBroadcaster,
    method: SitOutMethod = SIT_OUT_METHOD_NEXT_HAND
): Promise<string | null> => {
    if (!tableId) return null;
    announce(send, NonPlayerActionType.SIT_OUT);
    try {
        const result = await sitOut(tableId, network, method);
        return result?.hash || null;
    } catch (error: unknown) {
        console.error("Failed to sit out:", error);
        return null;
    }
};

const handleSitIn = async (
    tableId: string | undefined,
    network: NetworkEndpoints,
    send: OptimisticBroadcaster,
    method: SitInMethod = SIT_IN_METHOD_POST_NOW
): Promise<string | null> => {
    console.log("🎲 handleSitIn called with:", { tableId, network, method });
    if (!tableId) {
        console.error("❌ handleSitIn: tableId is undefined");
        return null;
    }
    announce(send, NonPlayerActionType.SIT_IN);
    try {
        console.log("📞 Calling sitIn action...");
        const result = await sitIn(tableId, network, method);
        console.log("✅ Sit in completed successfully, hash:", result?.hash);
        return result?.hash || null;
    } catch (error: unknown) {
        console.error("❌ Failed to sit in:", error);
        return null;
    }
};

// =============================================================================
// Amount-first handlers (amount, tableId, network) -> Promise<string | null>
// =============================================================================

/**
 * Handle call action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handleCall = createAmountFirstHandler("call", PlayerActionType.CALL, callHand);

/**
 * Handle bet action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handleBet = createAmountFirstHandler("bet", PlayerActionType.BET, betHand);

// =============================================================================
// TableId-amount handlers (tableId, amount, network) -> Promise<string | null>
// =============================================================================

/**
 * Handle post small blind action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handlePostSmallBlind = createTableIdAmountHandler("post small blind", PlayerActionType.SMALL_BLIND, postSmallBlind, {
    attemptLog: "🎰 Attempting to post small blind:",
    successLog: "✅ Small blind posted successfully"
});

/**
 * Handle post big blind action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handlePostBigBlind = createTableIdAmountHandler("post big blind", PlayerActionType.BIG_BLIND, postBigBlind, {
    successLog: "✅ Big blind posted successfully"
});

/**
 * Handle raise action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handleRaise = createTableIdAmountHandler("raise", PlayerActionType.RAISE, raiseHand);

// =============================================================================
// Exports
// =============================================================================

export {
    handleBet,
    handleCall,
    handleCheck,
    handleDeal,
    handleFold,
    handleMuck,
    handleShow,
    handleSitIn,
    handleSitOut,
    handleStartNewHand,
    handlePostSmallBlind,
    handlePostBigBlind,
    handleRaise
};

// Also export the factories for potential reuse
export { createSimpleHandler, createAmountFirstHandler, createTableIdAmountHandler };
export type { ActionHandlerOptions, ActionResult };
