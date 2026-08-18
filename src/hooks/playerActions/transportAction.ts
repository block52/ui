/**
 * Action executor — the single funnel every per-action helper (callHand,
 * foldHand, ...) routes through (ui#440 PR 2).
 *
 * Actions submit chain-direct via the SDK's performActionSync. The action
 * index is assigned by the chain at execution from committed state
 * (pokerchain#273), so the client never supplies one.
 *
 * These helpers are plain async functions (no React context). The latest
 * game-state snapshot is published by GameStateContext via setLatestGameState()
 * for callers that need to resolve state off the React tree (join seat
 * resolution, SNG finishing order).
 */
import { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { getSigningClient } from "../../utils/cosmos/client";
import { hasElements } from "../../utils/guards";

let latestGameState: TexasHoldemStateDTO | undefined;

/** Logical-track observers, notified on every snapshot published below. */
type LatestGameStateListener = (gameState: TexasHoldemStateDTO | undefined) => void;
const latestGameStateListeners = new Set<LatestGameStateListener>();

/** Published by GameStateContext on every state update. */
export function setLatestGameState(gameState: TexasHoldemStateDTO | undefined): void {
    latestGameState = gameState;
    latestGameStateListeners.forEach(listener => listener(gameState));
}

/**
 * Subscribe to the logical track (the immediate-at-ingest snapshot the bus
 * publishes). Returns an unsubscribe function. Used by the outbound action
 * submission controller to read fresh confirmation signals without polling.
 */
export function subscribeLatestGameState(listener: LatestGameStateListener): () => void {
    latestGameStateListeners.add(listener);
    return () => {
        latestGameStateListeners.delete(listener);
    };
}

/**
 * Next action index for a player not yet seated (join).
 *
 * The engine validates `index === actionCount + previousActions.length + 1`
 * (TexasHoldem.getActionIndex), which is the SDK's canonical
 * getNextActionIndex. We must reproduce that formula exactly.
 *
 * The previous approach — reading a seated player's `legalActions[0].index`
 * with a fallback of 1 — only holds while the game is running. A Sit-and-Go
 * waiting to fill has SEATED (not yet ACTIVE) players that carry NO
 * legalActions, so it fell through to the stale `1` fallback: the first join
 * (index 1) landed, but every subsequent join still sent `1` while the engine
 * now expected 2, 3, … → "Invalid action index", join rejected (ui#440).
 * Cash games hid this because you join a running table whose seated players
 * do carry the correct index.
 */
export function nextActionIndex(gameState: TexasHoldemStateDTO | undefined): number {
    const previousActions = gameState?.previousActions;
    if (hasElements(previousActions)) {
        return previousActions[previousActions.length - 1].index + 1;
    }
    // Fresh/empty table: actionCount is 0 here, so this is 1 — matching the
    // prior empty-table default while staying correct for a seeded table whose
    // count is already non-zero.
    return (gameState?.actionCount ?? 0) + 1;
}

/** Latest snapshot, for callers that resolve their own index (join). */
export function getLatestGameState(): TexasHoldemStateDTO | undefined {
    return latestGameState;
}

/**
 * The engine keys replay protection on the action index (TexasHoldem
 * .getActionIndex) and rejects a mismatch with "Invalid action index." This
 * happens when ANOTHER player acts between our state snapshot and our submit —
 * a mid-hand join / sit-in consumes indices — leaving ours stale. See ui#530.
 */
export function isStaleIndexError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /invalid action index/i.test(msg);
}

// User-facing, retryable message for the stale-index case. We deliberately do
// NOT auto-retry (that can mask real problems / double-fire); instead we surface
// a clear prompt so the user re-submits, which recomputes the index from the
// state that has since advanced. Kept short so the action-error toast reads well.
export const STALE_INDEX_MESSAGE = "Your turn advanced while you were acting — please try again.";

export async function executeTransportAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    try {
        const { signingClient } = await getSigningClient(network);
        const transactionHash = await signingClient.performActionSync(tableId, action, amount, data);
        return {
            hash: transactionHash,
            gameId: tableId,
            action,
            amount: amount.toString()
        };
    } catch (err) {
        // Rewrite the raw "Invalid action index" into a clear, retryable prompt
        // (ui#530). A rejected action was NOT applied, so re-submitting is safe.
        // Every other error propagates unchanged.
        if (isStaleIndexError(err)) {
            throw new Error(STALE_INDEX_MESSAGE);
        }
        throw err;
    }
}
