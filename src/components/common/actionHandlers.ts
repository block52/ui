import {
    betHand,
    callHand,
    checkHand,
    dealCards,
    foldHand,
    muckCards,
    showCards,
    sitIn,
    SIT_IN_METHOD_NEXT_BB,
    sitOut,
    SIT_OUT_METHOD_NEXT_HAND,
    startNewHand,
    postSmallBlind,
    postBigBlind,
    raiseHand
} from "../../hooks/playerActions";
import type { SitInMethod, SitOutMethod } from "../../hooks/playerActions";
import type { NetworkEndpoints } from "../../context/NetworkContext";

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
    /** Show alert on error (optional) */
    alertOnError?: boolean;
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
    actionFn: (tableId: string, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        tableId: string | undefined,
        network: NetworkEndpoints
    ): Promise<string | null> => {
        if (!tableId) return null;

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
    actionFn: (tableId: string, amount: bigint, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        amount: bigint,
        tableId: string | undefined,
        network: NetworkEndpoints
    ): Promise<string | null> => {
        if (!tableId) return null;

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
    actionFn: (tableId: string, amount: bigint, network: NetworkEndpoints) => Promise<ActionResult | null>,
    options: ActionHandlerOptions = {}
) {
    return async (
        tableId: string | undefined,
        amount: bigint,
        network: NetworkEndpoints
    ): Promise<string | null> => {
        if (!tableId) return null;

        try {
            const result = await actionFn(tableId, amount, network);

            return result?.hash || null;
        } catch (error: any) {
            console.error(`Failed to ${actionName}:`, error);

            if (options.alertOnError) {
                alert(`Failed to ${actionName}: ${error.message}`);
            }

            return null;
        }
    };
}

// =============================================================================
// Simple handlers (tableId, network) -> Promise<string | null>
// =============================================================================

const handleCheck = createSimpleHandler("check", checkHand);

const handleFold = createSimpleHandler("fold", foldHand);

const handleMuck = createSimpleHandler("muck cards", muckCards);

const handleShow = createSimpleHandler("show cards", showCards);

const handleDeal = createSimpleHandler("deal", dealCards, {
    successLog: "Deal completed successfully"
});

const handleStartNewHand = createSimpleHandler("start new hand", startNewHand);

const handleSitOut = async (
    tableId: string | undefined,
    network: NetworkEndpoints,
    method: SitOutMethod = SIT_OUT_METHOD_NEXT_HAND
): Promise<string | null> => {
    if (!tableId) return null;
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
    method: SitInMethod = SIT_IN_METHOD_NEXT_BB
): Promise<string | null> => {
    if (!tableId) return null;
    try {
        const result = await sitIn(tableId, network, method);
        console.log("Sit in completed successfully");
        return result?.hash || null;
    } catch (error: unknown) {
        console.error("Failed to sit in:", error);
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
const handleCall = createAmountFirstHandler("call", callHand);

/**
 * Handle bet action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handleBet = createAmountFirstHandler("bet", betHand);

// =============================================================================
// TableId-amount handlers (tableId, amount, network) -> Promise<string | null>
// =============================================================================

/**
 * Handle post small blind action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handlePostSmallBlind = createTableIdAmountHandler("post small blind", postSmallBlind, {
    attemptLog: "🎰 Attempting to post small blind:",
    successLog: "✅ Small blind posted successfully",
    alertOnError: true
});

/**
 * Handle post big blind action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handlePostBigBlind = createTableIdAmountHandler("post big blind", postBigBlind, {
    successLog: "✅ Big blind posted successfully"
});

/**
 * Handle raise action
 * @param amount - Amount in micro-units as bigint (10^6 precision)
 */
const handleRaise = createTableIdAmountHandler("raise", raiseHand);

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
