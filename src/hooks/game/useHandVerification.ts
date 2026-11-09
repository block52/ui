import { useEffect, useMemo, useState } from "react";
import { useNetwork, NETWORK_PRESETS } from "../../context/NetworkContext";
import { useCometRpcApiFactory, useCosmosApiFactory } from "../../context/CosmosApiContext";
import { handEndedQuery, handStartedQuery, historyNetworks } from "../../utils/handReplay";
import { publicStateAt } from "../../utils/chainHistory";
import { isNullish } from "../../utils/guards";
import {
    dealtSeatsFromState,
    parseFirstTx,
    parseHandCompleted,
    parseNewHandSeed,
    verifyHand,
    type HandEvidence,
    type HandPhase,
    type HandVerification,
    type TxRef,
    type VerificationStatus
} from "../../utils/provablyFair";


export interface HandVerificationResult {
    /** pending: the hand is still being played, so nothing is fetched or shown. */
    status: VerificationStatus;
    evidence: HandEvidence | null;
    verification: HandVerification | null;
    /** The new-hand transaction that carried the seed. */
    startTx: TxRef | null;
    /** The block the hand ended in. */
    endHeight: number | null;
    error: string | null;
}

interface UseHandVerificationArgs {
    tableId: string | undefined;
    handNumber: number | null;
    /** 2 at Hold'em, 4 at Omaha (SDK holeCardsPerPlayer). */
    holeCardsPerPlayer: number;
    /** From handPhase(liveState, handNumber): a running hand is never fetched. */
    phase: HandPhase;
    /** Fetch only while the verify window is open. */
    enabled: boolean;
}

interface Fetched {
    evidence: HandEvidence;
    startTx: TxRef | null;
    endHeight: number;
}

/**
 * The chain evidence for a finished hand, and its verification (ui#972).
 *
 * Reads, on the current node then the official history node (like `?hand=N`):
 * the `hand_started` tx (its new-hand message carries the seed, read from the
 * REST tx), the `hand_ended` tx (its `hand_completed` event carries the board
 * and the hands shown at showdown), and the public state at that block (the
 * dealt-in seats, used only when it is still that hand's state). A hand that is
 * still running is never fetched: its seed would give away every card.
 */
export function useHandVerification({ tableId, handNumber, holeCardsPerPlayer, phase, enabled }: UseHandVerificationArgs): HandVerificationResult {
    const { currentNetwork } = useNetwork();
    const cometRpcApiFactory = useCometRpcApiFactory();
    const cosmosApiFactory = useCosmosApiFactory();

    const [fetched, setFetched] = useState<Fetched | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const ready = enabled && phase === "ended" && !isNullish(tableId) && !isNullish(handNumber);

    useEffect(() => {
        setFetched(null);
        setError(null);
        if (!ready || isNullish(tableId) || isNullish(handNumber)) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);

        const run = async () => {
            const failures: string[] = [];
            for (const network of historyNetworks(currentNetwork, NETWORK_PRESETS)) {
                try {
                    const rpc = cometRpcApiFactory(network.rpc);
                    const [startedResponse, endedResponse] = await Promise.all([
                        rpc.txSearch(handStartedQuery(tableId, handNumber), 1, "asc"),
                        rpc.txSearch(handEndedQuery(tableId, handNumber), 1, "asc")
                    ]);
                    const started = parseFirstTx(startedResponse);
                    const ended = parseFirstTx(endedResponse);
                    const shown = parseHandCompleted(ended, holeCardsPerPlayer);
                    if (isNullish(ended) || isNullish(shown)) {
                        failures.push(`${network.name}: no record of how hand ${handNumber} ended`);
                        continue;
                    }
                    const [seed, endState] = await Promise.all([
                        started ? cosmosApiFactory(network.rest).getTx(started.hash).then(parseNewHandSeed) : Promise.resolve(null),
                        publicStateAt(rpc, tableId, ended.height).catch(err => {
                            console.error("[useHandVerification] end state lookup failed:", err);
                            return null;
                        })
                    ]);
                    if (cancelled) return;
                    setFetched({
                        evidence: {
                            seed,
                            holeCardsPerPlayer,
                            board: shown.board,
                            shownHands: shown.shownHands,
                            dealtSeats: dealtSeatsFromState(endState, handNumber, holeCardsPerPlayer)
                        },
                        startTx: started ? { hash: started.hash, height: started.height } : null,
                        endHeight: ended.height
                    });
                    setIsLoading(false);
                    return;
                } catch (err) {
                    failures.push(`${network.name}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            if (cancelled) return;
            console.error("[useHandVerification] lookups failed:", failures);
            setError(`Hand #${handNumber} can't be verified right now: the nodes have no record of how it ended.`);
            setIsLoading(false);
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [ready, tableId, handNumber, holeCardsPerPlayer, currentNetwork, cometRpcApiFactory, cosmosApiFactory]);

    const verification = useMemo(() => (fetched ? verifyHand(fetched.evidence) : null), [fetched]);

    const status: VerificationStatus = !enabled
        ? "idle"
        : phase === "running"
          ? "pending"
          : !ready
            ? "idle"
            : !isNullish(error)
              ? "error"
              : isLoading || isNullish(verification)
                ? "loading"
                : "ready";

    return {
        status,
        evidence: fetched?.evidence ?? null,
        verification,
        startTx: fetched?.startTx ?? null,
        endHeight: fetched?.endHeight ?? null,
        error
    };
}
