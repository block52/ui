/**
 * Hands the indexer never attached to a wallet, confirmed on the public chain.
 *
 * `hand_players` is written only when the end snapshot's round is showdown or
 * end. A hand that finishes in the same block the next one starts is stored
 * as community cards only, so the wallet's list skips it. Sessions say which
 * tables the wallet sat at; the chain's masked state says whether they
 * actually played. Nodes keep about 30 days of that state.
 */

import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";
import type { PlayerHand, PlayerSession, PlayerSessionsResponse } from "../types/players";
import type { HandListItem, HandListResponse } from "../pages/explorer/types";
import { encodeStringField1, parseAbciStringResponse } from "./abciQuery";
import { hasContent, hasElements, isNumber, isRecord, isString } from "./guards";
import { handKey } from "./handHistory";
import { playerHandFromState, unlistedHands } from "./handHistoryCards";
import { GAME_STATE_PUBLIC_PATH, handEndedQuery, parseGameStateJson, parseTxSearchHeight, snapshotHeights } from "./handReplay";

export interface HistoryRpc {
    txSearch(query: string): Promise<unknown>;
    abciQuery(path: string, dataHex: string, height: number): Promise<unknown>;
}

export interface RecoverHandsDeps {
    address: string;
    listed: Array<Pick<PlayerHand, "game_id" | "hand_number">>;
    sessions: (offset: number) => Promise<PlayerSessionsResponse>;
    gameHands: (gameId: string, offset: number) => Promise<HandListResponse>;
    rpcFor: (rpc: string) => HistoryRpc;
    networks: NetworkEndpoints[];
    /** Extra tables to search, such as every `<tournamentId>-t*` from getTournament. */
    extraGameIds?: readonly string[];
    /**
     * Chain `hand_ended` rows for one table. Used on extra (MTT) tables to
     * fill indexer gaps â€” the table list routinely omits hand 1.
     */
    endedHands?: (gameId: string) => Promise<Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">>>;
    signal?: AbortSignal;
    concurrency?: number;
}

function attributesOf(event: Record<string, unknown>): Record<string, string> {
    const fields: Record<string, string> = {};
    if (!Array.isArray(event.attributes)) return fields;
    for (const attribute of event.attributes) {
        if (!isRecord(attribute) || !isString(attribute.key) || !isString(attribute.value)) continue;
        fields[attribute.key] = attribute.value;
    }
    return fields;
}

function txSucceeded(tx: Record<string, unknown>): boolean {
    if (isNumber(tx.code)) return tx.code === 0;
    return isString(tx.code) && tx.code === "0";
}

function txHeight(tx: Record<string, unknown>): number | undefined {
    if (isNumber(tx.height) && Number.isSafeInteger(tx.height) && tx.height > 0) return tx.height;
    if (!isString(tx.height) || !/^\d+$/.test(tx.height)) return undefined;
    const height = Number(tx.height);
    return Number.isSafeInteger(height) && height > 0 ? height : undefined;
}

/** Finished hands of one table from a GetTxsEvent body (`hand_ended.game_id='â€¦'`). */
export function endedHandsFromTxSearch(body: unknown, gameId: string): Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">> {
    if (!isRecord(body) || !Array.isArray(body.tx_responses) || !hasContent(gameId)) return [];
    const want = gameId.toLowerCase();
    const byHand = new Map<number, Pick<HandListItem, "game_id" | "hand_number" | "block_height">>();
    for (const tx of body.tx_responses) {
        if (!isRecord(tx) || !txSucceeded(tx)) continue;
        const height = txHeight(tx);
        if (!Array.isArray(tx.events)) continue;
        for (const event of tx.events) {
            if (!isRecord(event) || event.type !== "hand_ended") continue;
            const fields = attributesOf(event);
            if ((fields.game_id ?? "").toLowerCase() !== want) continue;
            if (!/^\d+$/.test(fields.hand_number ?? "")) continue;
            const handNumber = Number(fields.hand_number);
            const blockHeight = /^\d+$/.test(fields.block_height ?? "") ? Number(fields.block_height) : height;
            if (!Number.isSafeInteger(handNumber) || handNumber < 1) continue;
            if (!hasValueNumber(blockHeight)) continue;
            if (!byHand.has(handNumber)) byHand.set(handNumber, { game_id: gameId, hand_number: handNumber, block_height: blockHeight });
        }
    }
    return [...byHand.values()];
}

function hasValueNumber(value: number | undefined): value is number {
    return isNumber(value) && Number.isSafeInteger(value) && value > 0;
}

function isExtraGameId(extra: readonly string[] | undefined, gameId: string): boolean {
    const want = gameId.toLowerCase();
    return (extra ?? []).some(id => id.toLowerCase() === want);
}

/**
 * One row per hand, keeping the later block height. The indexer table list
 * often stores the start block (the previous hand's `hand_ended`), not the
 * end block. Chain `hand_ended` rows carry the real end height.
 */
export function mergeHandEndHeights(
    indexed: ReadonlyArray<Pick<HandListItem, "game_id" | "hand_number" | "block_height">>,
    ended: ReadonlyArray<Pick<HandListItem, "game_id" | "hand_number" | "block_height">>
): Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">> {
    const byHand = new Map<string, Pick<HandListItem, "game_id" | "hand_number" | "block_height">>();
    for (const hand of [...indexed, ...ended]) {
        const key = handKey(hand);
        const current = byHand.get(key);
        if (!current || hand.block_height > current.block_height) byHand.set(key, hand);
    }
    return [...byHand.values()];
}

/** True when `next` is a later hand, so the matching snapshot is this hand's end. */
export function isFollowingHandSnapshot(next: { handNumber?: number } | undefined, handNumber: number): boolean {
    return isNumber(next?.handNumber) && next.handNumber > handNumber;
}

/** True when `next` is the previous hand, so the height was this hand's start. */
export function isPriorHandSnapshot(next: { handNumber?: number } | undefined, handNumber: number): boolean {
    return isNumber(next?.handNumber) && next.handNumber < handNumber;
}

export interface RecoveredHand {
    hand: PlayerHand;
    state: TexasHoldemStateDTO;
}

export interface RecoveredHands {
    hands: PlayerHand[];
    states: Map<string, TexasHoldemStateDTO>;
}

const SESSION_PAGE = 100;
const GAME_HAND_PAGE = 1000;

async function collectPages<T>(
    load: (offset: number) => Promise<{ data: T[] | null; pagination: { total: number } }>,
    signal?: AbortSignal
): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    while (offset < total) {
        if (signal?.aborted) return out;
        const page = await load(offset);
        total = page.pagination.total;
        // The indexer sends `data: null` when a table has no hands. That must not
        // abandon every later table.
        if (!hasElements(page.data)) break;
        out.push(...page.data);
        offset += page.data.length;
    }
    return out;
}

/** Runs `fn` over `items` with at most `limit` in flight. One failure does not stop the rest. */
export async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
    if (items.length === 0 || limit < 1) return;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (!signal?.aborted) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) return;
            try {
                await fn(items[index]);
            } catch (err) {
                console.error("Hand history lookup failed:", err);
            }
        }
    });
    await Promise.all(workers);
}

function inSession(blockHeight: number, windows: PlayerSession[]): boolean {
    if (windows.length === 0) return true;
    return windows.some(window =>
        blockHeight >= window.join_block && (window.leave_block === undefined || blockHeight <= window.leave_block)
    );
}

async function stateAtHeights(
    rpc: Pick<HistoryRpc, "abciQuery">,
    gameId: string,
    handNumber: number,
    endHeight: number,
    signal?: AbortSignal
): Promise<TexasHoldemStateDTO | null> {
    const request = encodeStringField1(gameId);
    for (const height of snapshotHeights(endHeight)) {
        if (signal?.aborted) return null;
        try {
            const json = parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, request, height));
            const parsed = parseGameStateJson(json);
            if (parsed.state.handNumber === handNumber) return parsed.state;
        } catch (err) {
            console.error(`Public state for ${gameId} hand ${handNumber} at block ${height}:`, err);
        }
    }
    return null;
}

/**
 * The masked public state of a finished hand. `blockHeight` is the end block
 * when the indexer recorded one; the block before it is the hand when the
 * next hand started in the same block.
 */
export async function loadPublicHandState(
    gameId: string,
    handNumber: number,
    blockHeight: number,
    networks: NetworkEndpoints[],
    rpcFor: (rpc: string) => Pick<HistoryRpc, "abciQuery">,
    signal?: AbortSignal
): Promise<TexasHoldemStateDTO | null> {
    if (!Number.isInteger(blockHeight) || blockHeight < 1) return null;
    for (const network of networks) {
        if (signal?.aborted) return null;
        const state = await stateAtHeights(rpcFor(network.rpc), gameId, handNumber, blockHeight, signal);
        if (state) return state;
    }
    return null;
}

async function statesAroundHandEnd(
    rpc: Pick<HistoryRpc, "abciQuery">,
    gameId: string,
    handNumber: number,
    endHeight: number,
    signal?: AbortSignal
): Promise<{ state: TexasHoldemStateDTO; nextState?: TexasHoldemStateDTO } | null> {
    const request = encodeStringField1(gameId);
    let state: TexasHoldemStateDTO | undefined;
    let nextState: TexasHoldemStateDTO | undefined;
    for (const height of snapshotHeights(endHeight)) {
        if (signal?.aborted) return null;
        try {
            const json = parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, request, height));
            const parsed = parseGameStateJson(json);
            if (parsed.state.handNumber === handNumber) state = parsed.state;
            else nextState = parsed.state;
        } catch (err) {
            console.error(`Public state for ${gameId} hand ${handNumber} at block ${height}:`, err);
        }
    }
    if (!state) return null;
    // The indexer start height shows this hand at endHeight and the previous
    // hand at endHeight-1. That is not the end — callers must try another height.
    if (isPriorHandSnapshot(nextState, handNumber)) return null;
    return { state, nextState };
}

async function confirmPlayedHand(
    candidate: Pick<HandListItem, "game_id" | "hand_number" | "block_height">,
    deps: RecoverHandsDeps
): Promise<RecoveredHand | null> {
    let query: string;
    try {
        query = handEndedQuery(candidate.game_id, candidate.hand_number);
    } catch (err) {
        console.error("Skipping a hand history id the chain query cannot express:", err);
        return null;
    }
    const knownHeight =
        isNumber(candidate.block_height) && Number.isSafeInteger(candidate.block_height) && candidate.block_height > 0
            ? candidate.block_height
            : undefined;

    const readAt = async (rpc: HistoryRpc, endHeight: number): Promise<RecoveredHand | null | undefined> => {
        const snapshots = await statesAroundHandEnd(rpc, candidate.game_id, candidate.hand_number, endHeight, deps.signal);
        if (!snapshots) return undefined;
        const hand = playerHandFromState(candidate.game_id, snapshots.state, deps.address, endHeight, snapshots.nextState);
        if (hand) return { hand, state: snapshots.state };
        // The player is absent only once this is clearly the end (the next hand
        // has started, or winners are recorded). A start-of-hand height has no
        // actions yet and must not skip the real end-height search.
        if (isFollowingHandSnapshot(snapshots.nextState, candidate.hand_number) || hasElements(snapshots.state.winners)) {
            return null;
        }
        return undefined;
    };

    for (const network of deps.networks) {
        if (deps.signal?.aborted) return null;
        const rpc = deps.rpcFor(network.rpc);
        try {
            // Prefer a known height, but only trust it once the snapshot is the
            // end of the hand. Indexer table rows are often the start height.
            if (knownHeight !== undefined) {
                const fromKnown = await readAt(rpc, knownHeight);
                if (fromKnown !== undefined) return fromKnown;
            }
            const endHeight = parseTxSearchHeight(await rpc.txSearch(query));
            if (endHeight === null) continue;
            const fromSearch = await readAt(rpc, endHeight);
            if (fromSearch !== undefined) return fromSearch;
        } catch (err) {
            console.error(`Hand history lookup ${candidate.game_id}#${candidate.hand_number} on ${network.name}:`, err);
        }
    }
    return null;
}

/** Played hands of the wallet's tables that `listed` does not already contain. */
export async function recoverUnlistedHands(deps: RecoverHandsDeps): Promise<RecoveredHands> {
    const hands: PlayerHand[] = [];
    const states = new Map<string, TexasHoldemStateDTO>();
    try {
        const sessions = await collectPages(offset => deps.sessions(offset), deps.signal);
        const gameIds = [...new Set([
            ...sessions.map(session => session.game_id),
            ...deps.listed.map(hand => hand.game_id),
            ...(deps.extraGameIds ?? [])
        ])];
        const candidates: Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">> = [];
        // Session tables are listed in parallel. A serial walk of dozens of tables
        // was long enough to leave the profile Stats cards on an ellipsis.
        const collected: Array<Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">>> = gameIds.map(() => []);
        await mapPool(
            gameIds.map((_, index) => index),
            deps.concurrency ?? 4,
            async index => {
                const gameId = gameIds[index];
                let gameHands: Array<Pick<HandListItem, "game_id" | "hand_number" | "block_height">> = await collectPages(
                    offset => deps.gameHands(gameId, offset),
                    deps.signal
                );
                if (deps.endedHands && isExtraGameId(deps.extraGameIds, gameId)) {
                    try {
                        const ended = await deps.endedHands(gameId);
                        if (hasElements(ended)) gameHands = mergeHandEndHeights(gameHands, ended);
                    } catch (err) {
                        console.error(`Failed to list hand_ended events for ${gameId}:`, err);
                    }
                }
                const windows = sessions.filter(session => session.game_id === gameId);
                collected[index] = unlistedHands(deps.listed, gameHands).filter(hand => inSession(hand.block_height, windows));
            },
            deps.signal
        );
        for (const rows of collected) candidates.push(...rows);
        candidates.sort((a, b) => b.block_height - a.block_height || b.hand_number - a.hand_number);
        const claimed = new Set<string>();
        await mapPool(candidates, deps.concurrency ?? 4, async candidate => {
            const key = handKey(candidate);
            if (claimed.has(key)) return;
            claimed.add(key);
            const found = await confirmPlayedHand(candidate, deps);
            if (!found || states.has(handKey(found.hand))) return;
            hands.push(found.hand);
            states.set(handKey(found.hand), found.state);
        }, deps.signal);
    } catch (err) {
        console.error("Failed to recover unlisted hands:", err);
    }
    return { hands, states };
}

export const historySessionPageSize = SESSION_PAGE;
export const historyGameHandPageSize = GAME_HAND_PAGE;
