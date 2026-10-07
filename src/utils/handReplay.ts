/**
 * Pure helpers for read-only hand replay by number (`/table/{id}?hand=N`).
 *
 * How a past hand is loaded, with no chain change and no custom HTTP headers:
 *   1. CometBFT `tx_search` for the `hand_ended` event of (gameId, N) → block height H.
 *   2. CometBFT `abci_query` of the GameStatePublic query AT height H → the table as it
 *      stood when hand N ended: final board, pots, winners, stacks, and only the hole
 *      cards that were shown (everything else is masked by the chain).
 *   If hand N ended in the same block that hand N+1 started, H already shows hand N+1;
 *   H-1 then gives hand N's last action before the end.
 * Historical state only exists on nodes that keep it (default pruning ≈ 30 days).
 * Older hands need pokerchain#388.
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";

/** gRPC method path of the public (masked) game state query, as abci_query expects it. */
export const GAME_STATE_PUBLIC_PATH = "/pokerchain.poker.v1.Query/GameStatePublic";

/** CometBFT tx_search query for the block where hand `handNumber` of `gameId` ended. */
export function handEndedQuery(gameId: string, handNumber: number): string {
    return handEventQuery("hand_ended", gameId, handNumber);
}

/** CometBFT tx_search query for the block where hand `handNumber` of `gameId` started. */
export function handStartedQuery(gameId: string, handNumber: number): string {
    return handEventQuery("hand_started", gameId, handNumber);
}

function handEventQuery(event: "hand_ended" | "hand_started", gameId: string, handNumber: number): string {
    if (!/^[A-Za-z0-9]+$/.test(gameId)) {
        throw new Error(`Invalid table id: ${gameId}`);
    }
    if (!Number.isInteger(handNumber) || handNumber < 1) {
        throw new Error(`Invalid hand number: ${handNumber}`);
    }
    return `${event}.game_id='${gameId}' AND ${event}.hand_number='${handNumber}'`;
}

interface TxSearchResponse {
    result?: { total_count?: string; txs?: Array<{ height?: string }> };
}

/** Height of the first tx in a tx_search result, or null when there is none. */
export function parseTxSearchHeight(response: unknown): number | null {
    const txs = (response as TxSearchResponse)?.result?.txs;
    if (!Array.isArray(txs) || txs.length === 0) return null;
    const height = Number(txs[0].height);
    return Number.isInteger(height) && height > 0 ? height : null;
}

/** Heights to try for a hand's final state: the end block, then the one before it. */
export function snapshotHeights(endHeight: number): number[] {
    return endHeight > 1 ? [endHeight, endHeight - 1] : [endHeight];
}

export interface ParsedGameState {
    state: TexasHoldemStateDTO;
    format: string | undefined;
    variant: string | undefined;
    name: string | undefined;
}

/**
 * Parses the chain's `game_state` JSON. It may be a GameStateResponseDTO (state nested
 * under `gameState`, with format/variant at the root) or a bare TexasHoldemStateDTO.
 */
export function parseGameStateJson(json: string): ParsedGameState {
    const parsed = JSON.parse(json);
    const state = (parsed.gameState ?? parsed) as TexasHoldemStateDTO;
    if (typeof state?.handNumber !== "number") {
        throw new Error("Game state has no handNumber");
    }
    const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
    return { state, format: str(parsed.format), variant: str(parsed.variant), name: str(parsed.name) };
}

/** Parses the chain's `Game` query response (`{ game: "<GameStateResponseDTO JSON>" }`). */
export function parseGameRecordResponse(response: unknown): ParsedGameState {
    const game = (response as { game?: unknown } | null)?.game;
    if (typeof game !== "string") throw new Error("Game record has no `game` JSON");
    return parseGameStateJson(game);
}

/** Read-only share link for a hand: opens its final state (showdown or last action). */
export function buildHandShareUrl(origin: string, tableId: string, handNumber: number): string {
    return `${origin}/table/${tableId}?hand=${handNumber}`;
}

/**
 * Networks to try for history, in order: the current one, then the official Block52
 * node, which keeps ~30 days of state (some nodes prune everything, e.g. Texas Hodl).
 * Localhost is never swapped for mainnet.
 */
export function historyNetworks(current: NetworkEndpoints, presets: NetworkEndpoints[]): NetworkEndpoints[] {
    const out = [current];
    if (current.name === "Localhost") return out;
    const official = presets.find(n => n.name === "Block52");
    if (official && official.rpc !== current.rpc) out.push(official);
    return out;
}
