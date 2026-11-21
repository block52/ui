import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useCometRpcApiFactory } from "../../context/CosmosApiContext";
import { NETWORK_PRESETS, useNetwork } from "../../context/NetworkContext";
import { block52HistoryRpc, publicStateAt, publicStateAtFallingBack } from "../../utils/chainHistory";
import { hasContent, hasValue, isEmpty } from "../../utils/guards";
import {
    contributionFromActions,
    handKeyForTarget,
    readHandLogAtHeights,
    type ContributionSnapshot,
    type HandContributionTarget
} from "../../utils/handContribution";
import { mapWithConcurrency } from "../../utils/pagedFetch";
import { countDealtHands, type DealtHandLog } from "../../utils/handsPlayed";
import { addHandStyle, emptyPlayingStyle, styleFromSnapshot, type PlayingStyleCounts, type PlayingStyleHand } from "../../utils/playingStyle";

/**
 * One public snapshot per hand, shared by Biggest Hand Profit and Playing Style.
 * Null when the node no longer has that hand. A second ask for the same hand
 * reads this map and does not query again.
 */
const memory = new Map<string, ContributionSnapshot | null>();
const inflight = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

const cacheKey = (network: string, player: string, key: string): string => `${network}\0${player.toLowerCase()}\0${key}`;

const emit = (): void => {
    version += 1;
    listeners.forEach(listener => listener());
};

const subscribeHandLogs = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const getHandLogVersion = (): number => version;

export function clearHandContributionCache(): void {
    memory.clear();
    inflight.clear();
}

export interface HandContributions {
    /** `gameId#handNumber` → what this player put in. Missing keys were not read, or failed. */
    byKey: Record<string, number>;
    /** True while a requested hand has not been read yet. */
    pending: boolean;
    /** Requested hands whose action log could not be read. */
    unavailable: number;
}

export interface PlayingStyleRead {
    counts: PlayingStyleCounts;
    /** True while a requested hand has not been read yet. */
    pending: boolean;
    /** Requested hands whose action log could not be read. Left out of the counts. */
    unavailable: number;
    /**
     * Distinct hands whose log shows this player was dealt in.
     * Same snapshots as `counts`. A missing log is not included.
     */
    dealt: number;
}

function useHandLogVersion(): number {
    return useSyncExternalStore(subscribeHandLogs, getHandLogVersion, getHandLogVersion);
}

/**
 * Fills the shared snapshot cache. The selected node is asked first. A pruned
 * height is read again on Block52; any other error stays on the selected node.
 */
function useHandLogs(player: string | undefined, hands: HandContributionTarget[], enabled: boolean): number {
    const { currentNetwork } = useNetwork();
    const rpcFactory = useCometRpcApiFactory();
    const logVersion = useHandLogVersion();
    const networkName = currentNetwork.name;
    const fallbackRpc = useMemo(() => block52HistoryRpc(currentNetwork, NETWORK_PRESETS), [currentNetwork]);
    const listKey = hands.map(handKeyForTarget).join("\n");

    useEffect(() => {
        if (!enabled || !hasContent(player) || !hasContent(listKey)) return;
        const missing = hands.filter(hand => {
            const key = cacheKey(networkName, player, handKeyForTarget(hand));
            return !memory.has(key) && !inflight.has(key);
        });
        if (isEmpty(missing)) return;
        for (const hand of missing) inflight.add(cacheKey(networkName, player, handKeyForTarget(hand)));
        mapWithConcurrency(missing, 3, async hand => {
            const key = cacheKey(networkName, player, handKeyForTarget(hand));
            try {
                const state = await readHandLogAtHeights(hand, (gameId, height) =>
                    publicStateAtFallingBack(rpcUrl => publicStateAt(rpcFactory(rpcUrl), gameId, height), currentNetwork.rpc, fallbackRpc)
                );
                memory.set(key, hasValue(state) ? state : null);
            } catch (err) {
                console.error("Failed to read hand state for contribution:", err);
                memory.set(key, null);
            } finally {
                inflight.delete(key);
            }
        }).then(emit);
    }, [currentNetwork.rpc, enabled, fallbackRpc, hands, listKey, logVersion, networkName, player, rpcFactory]);

    return logVersion;
}

function collectContributions(network: string, player: string | undefined, hands: HandContributionTarget[], enabled: boolean): HandContributions {
    if (!enabled || !hasContent(player)) return { byKey: {}, pending: false, unavailable: 0 };
    const byKey: Record<string, number> = {};
    const seen = new Set<string>();
    let unavailable = 0;
    let pending = false;
    for (const hand of hands) {
        const key = handKeyForTarget(hand);
        if (seen.has(key)) continue;
        seen.add(key);
        const stored = cacheKey(network, player, key);
        if (!memory.has(stored)) {
            pending = true;
            continue;
        }
        const state = memory.get(stored);
        const value = hasValue(state) ? contributionFromActions(state.previousActions, player) : undefined;
        if (!hasValue(value)) unavailable += 1;
        else byKey[key] = value;
    }
    return { byKey, pending, unavailable };
}

function collectStyle(network: string, player: string | undefined, hands: PlayingStyleHand[], enabled: boolean): PlayingStyleRead {
    if (!enabled || !hasContent(player)) return { counts: emptyPlayingStyle(), pending: false, unavailable: 0, dealt: 0 };
    let counts = emptyPlayingStyle();
    const seen = new Set<string>();
    const resolved: DealtHandLog[] = [];
    let unavailable = 0;
    let pending = false;
    for (const hand of hands) {
        const key = handKeyForTarget(hand);
        if (seen.has(key)) continue;
        seen.add(key);
        const stored = cacheKey(network, player, key);
        if (!memory.has(stored)) {
            pending = true;
            continue;
        }
        const snapshot = memory.get(stored);
        resolved.push({ key, snapshot });
        const style = styleFromSnapshot(snapshot, player, hand.wonAmount);
        if (!hasValue(style)) unavailable += 1;
        else counts = addHandStyle(counts, style);
    }
    return { counts, pending, unavailable, dealt: countDealtHands(resolved, player) };
}

/**
 * Fills `contributed` for the profiled player's hands from public chain state.
 *
 * One abci_query per hand, a few at a time, shared with Playing Style. The
 * selected node is asked first. A pruned height is read again on Block52, the
 * same fallback Session History uses; any other error stays on the selected
 * node. Results stay in memory for the session. A hand neither node still has
 * is unavailable and left out of the profit, rather than counted as 0.
 */
export function useHandContributions(player: string | undefined, hands: HandContributionTarget[], enabled: boolean): HandContributions {
    const { currentNetwork } = useNetwork();
    const logVersion = useHandLogs(player, hands, enabled);
    // `logVersion` is not read inside the memo. It bumps when a batch lands in the module cache, which is what the memo has to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => collectContributions(currentNetwork.name, player, hands, enabled), [currentNetwork.name, enabled, hands, player, logVersion]);
}

/**
 * VPIP, PFR, aggression, WTSD and W$SD from the same snapshots as Biggest Hand Profit.
 * Every finished hand passed in is included, open session or not. A hand the node
 * no longer has is counted in `unavailable` and left out of the rates.
 */
export function usePlayingStyle(player: string | undefined, hands: PlayingStyleHand[], enabled: boolean): PlayingStyleRead {
    const { currentNetwork } = useNetwork();
    const logVersion = useHandLogs(player, hands, enabled);
    // `logVersion` is not read inside the memo. It bumps when a batch lands in the module cache, which is what the memo has to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => collectStyle(currentNetwork.name, player, hands, enabled), [currentNetwork.name, enabled, hands, player, logVersion]);
}
