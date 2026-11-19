import { useEffect, useMemo, useRef, useState } from "react";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useIndexerApi } from "../../context/IndexerApiContext";
import { useCometRpcApiFactory } from "../../context/CosmosApiContext";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerHand } from "../../types/players";
import { handKey } from "../../utils/handHistory";
import { historyGameHandPageSize, historySessionPageSize, recoverUnlistedHands } from "../../utils/handHistoryRecover";

interface UseRecoveredHandsResult {
    hands: PlayerHand[];
    states: ReadonlyMap<string, TexasHoldemStateDTO>;
    recovering: boolean;
    /** True once a finished indexer list has been compared with the chain. */
    searched: boolean;
}

/**
 * Hands the indexer omitted for this wallet, once its own list has finished
 * loading. A new wallet or network drops the previous result immediately.
 */
export interface RecoverHandsOptions {
    /** Extra tables to search, such as every `<tournamentId>-t*` from getTournament. */
    extraGameIds?: readonly string[];
    endedHands?: (gameId: string) => Promise<Array<Pick<PlayerHand, "game_id" | "hand_number" | "block_height">>>;
}

const NO_EXTRA_GAME_IDS: readonly string[] = [];

export function useRecoveredHands(
    address: string | null,
    listed: PlayerHand[],
    listedComplete: boolean,
    networks: NetworkEndpoints[],
    options?: RecoverHandsOptions
): UseRecoveredHandsResult {
    const indexerApi = useIndexerApi();
    const rpcFor = useCometRpcApiFactory();
    const [hands, setHands] = useState<PlayerHand[]>([]);
    const [states, setStates] = useState<ReadonlyMap<string, TexasHoldemStateDTO>>(() => new Map());
    const [recovering, setRecovering] = useState(false);
    const [searched, setSearched] = useState(false);
    const listedRef = useRef(listed);
    listedRef.current = listed;

    const listedKey = useMemo(() => listed.map(handKey).join("\n"), [listed]);
    const networksKey = networks.map(network => network.rpc).join("|");
    const extraGameIds = options?.extraGameIds ?? NO_EXTRA_GAME_IDS;
    const extraKey = extraGameIds.join("\n");
    const endedHands = options?.endedHands;

    // Identity-unstable callbacks and arrays must not abort an in-flight search.
    const extraGameIdsRef = useRef(extraGameIds);
    extraGameIdsRef.current = extraGameIds;
    const endedHandsRef = useRef(endedHands);
    endedHandsRef.current = endedHands;
    const networksRef = useRef(networks);
    networksRef.current = networks;
    const indexerApiRef = useRef(indexerApi);
    indexerApiRef.current = indexerApi;
    const rpcForRef = useRef(rpcFor);
    rpcForRef.current = rpcFor;

    useEffect(() => {
        setHands([]);
        setStates(new Map());
        setRecovering(false);
        setSearched(false);
    }, [address, networksKey, extraKey]);

    useEffect(() => {
        if (!address || !listedComplete) return;
        const controller = new AbortController();
        let cancelled = false;
        setRecovering(true);
        recoverUnlistedHands({
            address,
            listed: listedRef.current,
            sessions: offset => indexerApiRef.current.getPlayerSessions(address, historySessionPageSize, offset),
            gameHands: (gameId, offset) => indexerApiRef.current.getHands(gameId, offset, historyGameHandPageSize),
            rpcFor: rpcForRef.current,
            networks: networksRef.current,
            extraGameIds: extraGameIdsRef.current,
            endedHands: endedHandsRef.current,
            signal: controller.signal
        })
            .then(recovered => {
                if (cancelled) return;
                setHands(recovered.hands);
                setStates(recovered.states);
            })
            .catch(err => {
                console.error("Failed to recover unlisted hands:", err);
            })
            .finally(() => {
                if (cancelled) return;
                setRecovering(false);
                setSearched(true);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [address, listedComplete, listedKey, networksKey, extraKey]);

    return { hands, states, recovering, searched };
}
