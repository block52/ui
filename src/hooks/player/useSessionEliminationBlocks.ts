import { useEffect, useMemo, useRef, useState } from "react";
import { useCometRpcApiFactory, useCosmosApi } from "../../context/CosmosApiContext";
import { NETWORK_PRESETS, useNetwork } from "../../context/NetworkContext";
import { block52HistoryRpc, publicStateAt, publicStateAtFallingBack } from "../../utils/chainHistory";
import { hasContent, hasValue, isEmpty } from "../../utils/guards";
import { mapWithConcurrency } from "../../utils/pagedFetch";
import { findEliminationBlock, type SessionEliminationLookup } from "../../utils/sessionBust";

/** game id → elimination block. Null means the lookup finished without finding one. */
export type EliminationBlocks = Record<string, number | null>;

interface StoredBlocks {
    player: string;
    byGame: EliminationBlocks;
}

const EMPTY: StoredBlocks = { player: "", byGame: {} };

/**
 * Leave-block heights for busted Sit & Go and tournament sessions on the
 * current page. Each game is one binary search over hand_ended plus the
 * public state at that block (ABCI query — the REST height header is blocked by
 * the node's CORS policy). A height the selected node has pruned is read again
 * from Block52, which keeps state longer. Any other failure stays on the
 * selected node. A miss stays null so the cell keeps "—".
 */
export function useSessionEliminationBlocks(player: string | undefined, lookups: SessionEliminationLookup[]): EliminationBlocks {
    const cosmosApi = useCosmosApi();
    const { currentNetwork } = useNetwork();
    const rpcFactory = useCometRpcApiFactory();
    const rpc = useMemo(() => rpcFactory(currentNetwork.rpc), [rpcFactory, currentNetwork.rpc]);
    const fallbackRpc = useMemo(() => block52HistoryRpc(currentNetwork, NETWORK_PRESETS), [currentNetwork]);
    const [stored, setStored] = useState<StoredBlocks>(EMPTY);
    const lookupsRef = useRef(lookups);
    const storedRef = useRef(stored);
    lookupsRef.current = lookups;
    storedRef.current = stored;
    const key = lookups.map(lookup => `${lookup.gameId}:${lookup.handCount}`).join("\n");

    useEffect(() => {
        if (!hasContent(player) || !hasContent(key)) return;
        const currentLookups = lookupsRef.current;
        const currentStored = storedRef.current;
        let cancelled = false;
        const pending = currentLookups.filter(lookup => {
            if (currentStored.player !== player) return true;
            return !Object.prototype.hasOwnProperty.call(currentStored.byGame, lookup.gameId);
        });
        if (isEmpty(pending)) return;
        mapWithConcurrency(pending, 3, async lookup => {
            try {
                const block = await findEliminationBlock(lookup.gameId, lookup.handCount, player, {
                    handEnded: query => cosmosApi.getSentTransactions(query, { limit: 5, page: 1 }),
                    stateAt: async (gameId, height) => ({
                        gameState: await publicStateAtFallingBack(
                            rpcUrl => publicStateAt(rpcUrl === currentNetwork.rpc ? rpc : rpcFactory(rpcUrl), gameId, height),
                            currentNetwork.rpc,
                            fallbackRpc
                        )
                    })
                });
                return [lookup.gameId, hasValue(block) ? block : null] as const;
            } catch (err) {
                console.error("Failed to find elimination block:", err);
                return [lookup.gameId, null] as const;
            }
        }).then(entries => {
            if (cancelled) return;
            setStored(prev => {
                const byGame = prev.player === player ? { ...prev.byGame } : {};
                for (const [gameId, block] of entries) byGame[gameId] = block;
                return { player, byGame };
            });
        });
        return () => {
            cancelled = true;
        };
    }, [cosmosApi, currentNetwork.rpc, fallbackRpc, player, key, rpc, rpcFactory]);

    return stored.player === player ? stored.byGame : {};
}
