/**
 * Action executor — the single funnel every per-action helper (callHand,
 * foldHand, ...) routes through (ui#440 PR 2).
 *
 * Actions submit chain-direct via the SDK's performActionSync. The action
 * index is assigned by the chain at execution from committed state
 * (pokerchain#273), so the client never supplies one.
 *
 * These helpers are plain async functions (no React context). Each table's
 * latest game-state snapshot (its logical track, below) is published by its
 * GameStateProvider and read through useLogicalTrack().
 */
import { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { TrackMeta } from "../../bus/types";

import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { getSigningClient } from "../../utils/cosmos/client";
import { hasElements } from "../../utils/guards";

/**
 * Provenance of a logical-track snapshot (ui#609): the relay's `optimistic`
 * event is a projection of pending mempool actions, not committed state. Index
 * computation may use either (that is the point of the logical track); a
 * submission may be *accepted* on a projection but *confirmed* only on
 * committed state.
 */
export type LatestGameStateMeta = TrackMeta;

/** Logical-track observers, notified on every snapshot published. */
export type LatestGameStateListener = (gameState: TexasHoldemStateDTO | undefined, meta: LatestGameStateMeta) => void;

/**
 * The LOGICAL track for one table: the freshest ingested snapshot, published by
 * that table's GameMessageBus at ingest, and read by every submission decision
 * (the action-submit controller, auto-new-hand, call-the-clock, join seat
 * resolution, SNG claim).
 *
 * One per GameStateProvider (ui#834). It used to be a single module-level
 * variable, which was fine with one table but, with several tables mounted
 * (multi-tabling, ui#55), let whichever table ingested last overwrite the state
 * every other table's submissions and auto-actions read.
 */
export interface LogicalTrack {
    /** Latest snapshot, or undefined before the first state / after a reset. */
    get(): TexasHoldemStateDTO | undefined;
    /** Published by the bus at ingest on every state update (and by the provider on reset). */
    set(gameState: TexasHoldemStateDTO | undefined, meta: LatestGameStateMeta): void;
    /** Subscribe to every published snapshot. Returns an unsubscribe function. */
    subscribe(listener: LatestGameStateListener): () => void;
}

export function createLogicalTrack(): LogicalTrack {
    let latest: TexasHoldemStateDTO | undefined;
    const listeners = new Set<LatestGameStateListener>();
    return {
        get: () => latest,
        set: (gameState, meta) => {
            latest = gameState;
            listeners.forEach(listener => listener(gameState, meta));
        },
        subscribe: listener => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
}

/**
 * The default track: what a reader gets with no GameStateProvider above it
 * (LogicalTrackContext's default), and what the module-level helpers below use.
 * Every GameStateProvider creates its OWN track, so nothing in a live table
 * reads or writes this one.
 */
export const defaultLogicalTrack: LogicalTrack = createLogicalTrack();

/** Publish to the default track. Live tables publish to their own track instead. */
export function setLatestGameState(gameState: TexasHoldemStateDTO | undefined, meta: LatestGameStateMeta): void {
    defaultLogicalTrack.set(gameState, meta);
}

/** Subscribe to the default track. Live tables subscribe to their own track instead. */
export function subscribeLatestGameState(listener: LatestGameStateListener): () => void {
    return defaultLogicalTrack.subscribe(listener);
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

/** Latest snapshot on the default track. Live tables read their own track (useLogicalTrack). */
export function getLatestGameState(): TexasHoldemStateDTO | undefined {
    return defaultLogicalTrack.get();
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

async function broadcastAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    const { signingClient } = await getSigningClient(network);
    const transactionHash = await signingClient.performActionSync(tableId, action, amount, data);
    return {
        hash: transactionHash,
        gameId: tableId,
        action,
        amount: amount.toString()
    };
}

export async function executeTransportAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    try {
        return await broadcastAction(tableId, action, amount, network, data);
    } catch (err) {
        // No account-sequence recovery here, deliberately. From SDK 1.4.1
        // performActionSync signs UNORDERED (poker-vm#2619): gameplay txs carry
        // no sequence, so a code-32 mismatch cannot come from racing another of
        // our own txs — the 1.5 s wait-and-retry that used to live here only
        // ever re-read the same stale sequence anyway (ui#635). If one shows up
        // it means an ordered SDK build is in play; let it surface.
        // Rewrite the raw "Invalid action index" into a clear, retryable prompt
        // (ui#530). A rejected action was NOT applied, so re-submitting is safe.
        // Every other error propagates unchanged.
        if (isStaleIndexError(err)) {
            throw new Error(STALE_INDEX_MESSAGE);
        }
        throw err;
    }
}
