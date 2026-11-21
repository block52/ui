/**
 * Dealt-in hands for the Players list, from the same public logs as profile
 * Hands Played.
 *
 * The indexer directory stores total_hands as 0. This pages the indexer's hand
 * list and counts a hand only when the public log shows this player was dealt
 * in. A log the node no longer has (pruned or not found) is skipped, never
 * guessed as a played hand.
 *
 * The profile also searches for unlisted hands the indexer omitted. That walk
 * is too slow to run for every row on the list, so the list uses the indexed
 * hands only. Players whose indexer list is complete will match the profile;
 * a player with unlisted hands may show a slightly lower figure here.
 */
import type { NetworkEndpoints } from "../context/NetworkContext";
import type { PlayerHand, PlayerHandsResponse, PlayerListItem } from "../types/players";
import { publicStateAt, publicStateAtFallingBack } from "./chainHistory";
import { hasContent, hasElements, hasValue, isEmpty, isNumber } from "./guards";
import { readHandLogAtHeights } from "./handContribution";
import { handKey } from "./handHistory";
import { countDealtHands, type DealtHandLog } from "./handsPlayed";
import { fetchAllPages, mapWithConcurrency } from "./pagedFetch";
import { playingStyleHands } from "./playingStyle";

/** Players whose logs are read at once when filling the directory. */
export const DIRECTORY_HANDS_PLAYER_CONCURRENCY = 4;

/** Public-state reads in flight for one player, same as the profile. */
const HAND_LOG_CONCURRENCY = 3;

export interface DirectoryHandsRpc {
    abciQuery: (path: string, dataHex: string, height: number) => Promise<unknown>;
}

export interface DirectoryHandsDeps {
    getPlayerHands: (address: string, limit: number, offset: number) => Promise<PlayerHandsResponse>;
    rpcFor: (rpc: string) => DirectoryHandsRpc;
    networks: NetworkEndpoints[];
    fallbackRpc?: string;
    signal?: AbortSignal;
}

/** A finished chain count, or a failed read that must not fall back to the indexer's 0. */
export type DirectoryHandsCount = { dealt: number } | { failed: true };

export function isDirectoryHandsFailure(result: DirectoryHandsCount): result is { failed: true } {
    return "failed" in result;
}

/**
 * Dealt-in hands for one wallet, from the indexer's hand list and the public
 * logs. Returns `{ failed: true }` when the hand list cannot be read.
 */
export async function countHandsPlayedForPlayer(address: string, deps: DirectoryHandsDeps): Promise<DirectoryHandsCount> {
    if (!hasContent(address) || deps.signal?.aborted) return { failed: true };
    let listed: PlayerHand[];
    try {
        listed = await fetchAllPages(async (limit, offset) => {
            const page = await deps.getPlayerHands(address, limit, offset);
            const data = Array.isArray(page?.data) ? page.data : [];
            const reported = page?.pagination?.total;
            const total = isNumber(reported) ? reported : data.length;
            return { data, pagination: { total } };
        });
    } catch (err) {
        console.error(`Failed to list hands for ${address}:`, err);
        return { failed: true };
    }
    if (deps.signal?.aborted) return { failed: true };

    const selection = playingStyleHands(listed);
    const primaryRpc = deps.networks[0]?.rpc;
    if (!hasContent(primaryRpc)) return { failed: true };

    const logs: DealtHandLog[] = [];
    await mapWithConcurrency(selection.hands, HAND_LOG_CONCURRENCY, async hand => {
        if (deps.signal?.aborted) return;
        const key = handKey({ game_id: hand.gameId, hand_number: hand.handNumber });
        try {
            const state = await readHandLogAtHeights(hand, (gameId, height) =>
                publicStateAtFallingBack(rpcUrl => publicStateAt(deps.rpcFor(rpcUrl), gameId, height), primaryRpc, deps.fallbackRpc)
            );
            logs.push({ key, snapshot: hasValue(state) ? state : null });
        } catch (err) {
            console.error(`Failed to read hand log ${key} for ${address}:`, err);
            logs.push({ key, snapshot: null });
        }
    });
    if (deps.signal?.aborted) return { failed: true };
    return { dealt: countDealtHands(logs, address) };
}

/** Overlay chain counts onto directory rows. Unknown addresses are left unchanged. */
export function withDirectoryHands(players: PlayerListItem[], hands: ReadonlyMap<string, DirectoryHandsCount>): PlayerListItem[] {
    if (!hasElements(players) || hands.size === 0) return players;
    return players.map(player => {
        const result = hands.get(player.player_address.toLowerCase());
        if (!hasValue(result) || isDirectoryHandsFailure(result)) return player;
        return { ...player, total_hands: result.dealt };
    });
}

/** True when every listed player has a finished chain read (count or failure). */
export function directoryHandsComplete(players: PlayerListItem[], hands: ReadonlyMap<string, DirectoryHandsCount>): boolean {
    if (isEmpty(players)) return true;
    return players.every(player => hands.has(player.player_address.toLowerCase()));
}

/** Visible page first, then everyone else, so the open page fills before sort-wide work. */
export function directoryHandsOrder(visible: PlayerListItem[], all: PlayerListItem[]): string[] {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const player of [...visible, ...all]) {
        const key = player.player_address.toLowerCase();
        if (!hasContent(key) || seen.has(key)) continue;
        seen.add(key);
        order.push(player.player_address);
    }
    return order;
}

/** Label for the Hands column. Pending is an ellipsis; a failed read is not a zero. */
export function formatDirectoryHands(result: DirectoryHandsCount | undefined): string {
    if (!hasValue(result)) return "…";
    if (isDirectoryHandsFailure(result)) return "—";
    return result.dealt.toLocaleString();
}
