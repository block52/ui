import { useEffect, useRef, useState } from "react";
import { useNetwork, NETWORK_PRESETS } from "../../context/NetworkContext";
import { useCometRpcApiFactory } from "../../context/CosmosApiContext";
import { useGameActions } from "../../context/gameState/GameActionsContext";
import { GAME_STATE_PUBLIC_PATH, handEndedQuery, handStartedQuery, historyNetworks, parseGameStateJson, parseTxSearchHeight } from "../../utils/handReplay";
import { encodeStringField1, parseAbciStringResponse } from "../../utils/abciQuery";
import { actionsQuery, buildTimeline, parseActionHeights } from "../../utils/replayTimeline";
import {
    GAME_STATE_PATH,
    NO_KNOWN_CARDS,
    knownHoleCardsKey,
    mergeKnownHoleCards,
    ownHoleCards,
    parseBlockTime,
    revealedHoleCards,
    type KnownHoleCards
} from "../../utils/replayCards";
import { encodeGameStateRequest } from "../../utils/abciQuery";
import { getCosmosAddress, getCosmosMnemonic } from "../../utils/cosmos/storage";
import { signQueryMessage } from "../../utils/cosmos/signing";
import { hasElements } from "../../utils/guards";
import type { CometRpcApi } from "../../apis/Api";
import { useReplayTransport, type ReplayTransport } from "./useReplayTransport";

export interface ReplayTimeline {
    /** Block heights of the hand's steps, ascending; empty while loading or when nothing is known. */
    steps: number[];
    /** The table's latest hand (the top of "skip forward"), when known. */
    latestHand: number | null;
    /** Hole cards the viewer may see on every step: shown at showdown, or their own. */
    knownCards: KnownHoleCards;
    isLoading: boolean;
    error: string | null;
    transport: ReplayTransport;
}

interface UseReplayTimelineArgs {
    tableId: string | undefined;
    handNumber: number | null;
    /** Only fetch in replay mode; a live table never asks. */
    active: boolean;
}

const publicStateAt = async (rpc: CometRpcApi, tableId: string, height: number) =>
    parseGameStateJson(parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, encodeStringField1(tableId), height))).state;

/**
 * The viewer's own hole cards in the hand, through the chain's authenticated
 * GameState query signed with their key. The node checks the signed timestamp
 * against the queried block's own time, so the block's time is what gets
 * signed. Tried at the deal first (cards are always in state there), then at
 * the hand's end. Null when there is no wallet, the viewer wasn't dealt in, or
 * the node refuses.
 */
async function fetchOwnHoleCards(rpc: CometRpcApi, tableId: string, heights: number[]): Promise<Map<string, string[]> | null> {
    const address = getCosmosAddress();
    if (!address || !getCosmosMnemonic()) return null;
    for (const height of heights) {
        const timestamp = parseBlockTime(await rpc.block(height));
        const signature = await signQueryMessage(timestamp);
        if (!signature) return null;
        const data = encodeGameStateRequest({ gameId: tableId, playerAddress: address, timestamp, signature });
        const state = parseGameStateJson(parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PATH, data, height))).state;
        const cards = ownHoleCards(state, address);
        if (cards) return new Map([[address.toLowerCase(), cards]]);
    }
    return null;
}

/**
 * Every hole card the viewer is entitled to see during the hand: the hands
 * shown at showdown (from the hand's final state) plus their own. Each source
 * fails independently and quietly — a replay with masked cards still plays.
 */
async function fetchKnownCards(rpc: CometRpcApi, tableId: string, timeline: number[]): Promise<KnownHoleCards> {
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const [shown, own] = await Promise.all([
        publicStateAt(rpc, tableId, last)
            .then(revealedHoleCards)
            .catch(err => {
                console.error("[useReplayTimeline] showdown cards lookup failed:", err);
                return new Map<string, string[]>();
            }),
        fetchOwnHoleCards(rpc, tableId, first === last ? [first] : [first, last]).catch(err => {
            console.error("[useReplayTimeline] own cards lookup failed:", err);
            return null;
        })
    ]);
    return mergeKnownHoleCards(shown, own ?? NO_KNOWN_CARDS);
}

/**
 * The replay timeline of a hand and its transport (ui#816).
 *
 * Fetches the hand's step heights (`hand_started`, every `action_performed`,
 * `hand_ended` — one tx_search each, on the current node then the official
 * history node, like `?hand=N`), the table's latest hand number for the hand
 * selector, and the hole cards the viewer may see throughout the hand. Then,
 * whenever the transport's position moves, loads that step's public state
 * through the game-state context with those cards overlaid — except the final
 * step on arrival, which `?hand=N` has already loaded (it is re-read once the
 * known cards arrive, if there are any).
 */
export function useReplayTimeline({ tableId, handNumber, active }: UseReplayTimelineArgs): ReplayTimeline {
    const { currentNetwork } = useNetwork();
    const cometRpcApiFactory = useCometRpcApiFactory();
    const { loadHistoricalStateAtHeight } = useGameActions();

    const [steps, setSteps] = useState<number[]>([]);
    const [latestHand, setLatestHand] = useState<number | null>(null);
    const [knownCards, setKnownCards] = useState<KnownHoleCards>(NO_KNOWN_CARDS);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // The hand whose final state is on screen when its timeline arrives: the
    // transport rests at the last step and that step must not be re-fetched.
    const settledRef = useRef<string | null>(null);

    useEffect(() => {
        if (!active || !tableId || handNumber === null) {
            setSteps([]);
            setLatestHand(null);
            setKnownCards(NO_KNOWN_CARDS);
            setError(null);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setSteps([]);
        setKnownCards(NO_KNOWN_CARDS);
        settledRef.current = null;

        const run = async () => {
            const failures: string[] = [];
            for (const network of historyNetworks(currentNetwork, NETWORK_PRESETS)) {
                try {
                    const rpc = cometRpcApiFactory(network.rpc);
                    const [started, actions, ended] = await Promise.all([
                        rpc.txSearch(handStartedQuery(tableId, handNumber), 1, "asc"),
                        rpc.txSearch(actionsQuery(tableId, handNumber), 100, "asc"),
                        rpc.txSearch(handEndedQuery(tableId, handNumber), 1, "desc")
                    ]);
                    const timeline = buildTimeline(parseTxSearchHeight(started), parseActionHeights(actions), parseTxSearchHeight(ended));
                    if (!hasElements(timeline)) {
                        failures.push(`${network.name}: no record of hand ${handNumber}`);
                        continue;
                    }
                    const [latest, known] = await Promise.all([
                        publicStateAt(rpc, tableId, 0)
                            .then(now => now.handNumber)
                            .catch(err => {
                                console.error("[useReplayTimeline] latest hand lookup failed:", err);
                                return null;
                            }),
                        fetchKnownCards(rpc, tableId, timeline)
                    ]);
                    if (cancelled) return;
                    // The arrival state (`?hand=N`) is the final step with no overlay:
                    // settled only if there is nothing to overlay.
                    settledRef.current = `${tableId}:${handNumber}:${timeline.length - 1}:`;
                    setSteps(timeline);
                    setLatestHand(latest);
                    setKnownCards(known);
                    setIsLoading(false);
                    return;
                } catch (err) {
                    failures.push(`${network.name}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            if (cancelled) return;
            console.error("[useReplayTimeline] timeline lookups failed:", failures);
            setError(`Hand #${handNumber} has no replay: it may be older than the history the nodes keep.`);
            setIsLoading(false);
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [active, tableId, handNumber, currentNetwork, cometRpcApiFactory]);

    const transport = useReplayTransport(steps.length);

    // Load the step the transport points at (the arrival step is already shown).
    useEffect(() => {
        if (!active || !tableId || handNumber === null || !hasElements(steps)) return;
        const key = `${tableId}:${handNumber}:${transport.position}:${knownHoleCardsKey(knownCards)}`;
        if (settledRef.current === key) return;
        settledRef.current = key;
        void loadHistoricalStateAtHeight(tableId, handNumber, steps[transport.position], transport.position, knownCards);
    }, [active, tableId, handNumber, steps, knownCards, transport.position, loadHistoricalStateAtHeight]);

    return { steps, latestHand, knownCards, isLoading, error, transport };
}
