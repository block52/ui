import { useEffect, useRef, useState } from "react";
import { useNetwork, NETWORK_PRESETS } from "../../context/NetworkContext";
import { useCometRpcApiFactory } from "../../context/CosmosApiContext";
import { useGameActions } from "../../context/gameState/GameActionsContext";
import { GAME_STATE_PUBLIC_PATH, handEndedQuery, handStartedQuery, historyNetworks, parseGameStateJson, parseTxSearchHeight } from "../../utils/handReplay";
import { encodeStringField1, parseAbciStringResponse } from "../../utils/abciQuery";
import { actionsQuery, buildTimeline, parseActionHeights } from "../../utils/replayTimeline";
import { hasElements } from "../../utils/guards";
import { useReplayTransport, type ReplayTransport } from "./useReplayTransport";

export interface ReplayTimeline {
    /** Block heights of the hand's steps, ascending; empty while loading or when nothing is known. */
    steps: number[];
    /** The table's latest hand (the top of "skip forward"), when known. */
    latestHand: number | null;
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

/**
 * The replay timeline of a hand and its transport (ui#816).
 *
 * Fetches the hand's step heights (`hand_started`, every `action_performed`,
 * `hand_ended` — one tx_search each, on the current node then the official
 * history node, like `?hand=N`), and the table's latest hand number for the
 * hand selector. Then, whenever the transport's position moves, loads that
 * step's public state through the game-state context — except the final
 * step on arrival, which `?hand=N` has already loaded.
 */
export function useReplayTimeline({ tableId, handNumber, active }: UseReplayTimelineArgs): ReplayTimeline {
    const { currentNetwork } = useNetwork();
    const cometRpcApiFactory = useCometRpcApiFactory();
    const { loadHistoricalStateAtHeight } = useGameActions();

    const [steps, setSteps] = useState<number[]>([]);
    const [latestHand, setLatestHand] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // The hand whose final state is on screen when its timeline arrives: the
    // transport rests at the last step and that step must not be re-fetched.
    const settledRef = useRef<string | null>(null);

    useEffect(() => {
        if (!active || !tableId || handNumber === null) {
            setSteps([]);
            setLatestHand(null);
            setError(null);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setSteps([]);
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
                    let latest: number | null = null;
                    try {
                        const now = parseGameStateJson(parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, encodeStringField1(tableId), 0)));
                        latest = now.state.handNumber;
                    } catch (err) {
                        console.error("[useReplayTimeline] latest hand lookup failed:", err);
                    }
                    if (cancelled) return;
                    settledRef.current = `${tableId}:${handNumber}:${timeline.length - 1}`;
                    setSteps(timeline);
                    setLatestHand(latest);
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
        const key = `${tableId}:${handNumber}:${transport.position}`;
        if (settledRef.current === key) return;
        settledRef.current = key;
        void loadHistoricalStateAtHeight(tableId, handNumber, steps[transport.position], transport.position);
    }, [active, tableId, handNumber, steps, transport.position, loadHistoricalStateAtHeight]);

    return { steps, latestHand, isLoading, error, transport };
}
