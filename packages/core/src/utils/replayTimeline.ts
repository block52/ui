/**
 * Hand replay timeline (ui#816): the block heights at which a hand changed,
 * so a past hand can be watched back action by action.
 *
 * The chain emits `action_performed` for every action with the hand number
 * and block height, and `hand_started` / `hand_ended` around it. One
 * `tx_search` per event gives the heights; the public game state at each
 * height (abci_query, as `?hand=N` already uses for the final state) is one
 * step of the replay. Hole cards are whatever the chain had revealed by that
 * block — the real reveal timeline, never reconstructed (ui#721).
 *
 * Pure functions, so the transport can be tested without React or a node.
 */
import { TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { hasElements, hasValue } from "./guards";

/** CometBFT tx_search query for every action of hand `handNumber` of `gameId`. */
export function actionsQuery(gameId: string, handNumber: number): string {
    if (!/^[A-Za-z0-9]+$/.test(gameId)) {
        throw new Error(`Invalid table id: ${gameId}`);
    }
    if (!Number.isInteger(handNumber) || handNumber < 1) {
        throw new Error(`Invalid hand number: ${handNumber}`);
    }
    return `action_performed.game_id='${gameId}' AND action_performed.hand_number='${handNumber}'`;
}

interface TxSearchResponse {
    result?: { txs?: Array<{ height?: string }> };
}

/** Distinct block heights of a tx_search result, ascending; malformed entries are dropped. */
export function parseActionHeights(response: unknown): number[] {
    const txs = (response as TxSearchResponse)?.result?.txs;
    if (!Array.isArray(txs)) return [];
    const heights = new Set<number>();
    for (const tx of txs) {
        const height = Number(tx?.height);
        if (Number.isInteger(height) && height > 0) heights.add(height);
    }
    return [...heights].sort((a, b) => a - b);
}

/**
 * The replay's steps: the hand's start block (the deal), every block with an
 * action, and the end block, ascending and without repeats. Several actions in
 * one block are one step — the chain's state at a height is after all of them.
 */
export function buildTimeline(startHeight: number | null, actionHeights: number[], endHeight: number | null): number[] {
    const heights = new Set<number>();
    if (hasValue(startHeight) && startHeight > 0) heights.add(startHeight);
    for (const h of actionHeights) if (h > 0) heights.add(h);
    if (hasValue(endHeight) && endHeight > 0) heights.add(endHeight);
    return [...heights].sort((a, b) => a - b);
}

/**
 * The most recent hand a player can watch back: the current one once it has
 * ended, otherwise the one before it. `null` before the first hand completes.
 */
export function latestCompletedHand(state: Pick<TexasHoldemStateDTO, "handNumber" | "round"> | null | undefined): number | null {
    if (!state || !Number.isInteger(state.handNumber) || state.handNumber < 1) return null;
    const hand = state.round === TexasHoldemRound.END ? state.handNumber : state.handNumber - 1;
    return hand >= 1 ? hand : null;
}

/** Playback speeds offered by the transport. */
export const REPLAY_SPEEDS: readonly number[] = [0.5, 1, 2, 4];

/** Wall-clock pause between steps at 1×: long enough to read an action, short enough to feel live. */
export const REPLAY_STEP_MS = 1500;

/** The pause between steps at a speed (0.5× is twice as slow as 1×). */
export function stepDelayMs(speed: number): number {
    const factor = REPLAY_SPEEDS.includes(speed) ? speed : 1;
    return Math.round(REPLAY_STEP_MS / factor);
}

/** A position clamped into [0, stepCount − 1]; 0 when there are no steps. */
export function clampStep(position: number, stepCount: number): number {
    if (stepCount <= 0) return 0;
    return Math.min(Math.max(0, Math.floor(position)), stepCount - 1);
}

/** What the loaded step shows, for the transport's label: the last recorded action, or the deal. */
export function describeReplayStep(state: Pick<TexasHoldemStateDTO, "previousActions"> | null | undefined): string {
    if (!state || !hasElements(state.previousActions)) return "Cards dealt";
    const last = state.previousActions[state.previousActions.length - 1];
    const action = String(last.action).replace(/-/g, " ");
    return `${action.charAt(0).toUpperCase()}${action.slice(1)} · seat ${last.seat}`;
}
