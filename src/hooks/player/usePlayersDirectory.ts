import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerListItem, PlayerSearchParams } from "@block52/poker-ui-core/types/players";
import type { RefetchOptions } from "../useVisibleRefresh";

interface UsePlayersDirectoryResult {
    players: PlayerListItem[];
    total: number;
    loading: boolean;
    error: string | null;
    refetch: (options?: RefetchOptions) => void;
}

/**
 * Fetches a page of the searchable player directory from the indexer (ui#589).
 * The caller owns the search/sort/order/pagination state and passes it in;
 * this hook refetches whenever those params change. Only the latest request's
 * result is shown, so a slow refresh can't overwrite a newer page.
 */
export function usePlayersDirectory(params: PlayerSearchParams): UsePlayersDirectoryResult {
    const indexerApi = useIndexerApi();
    const [players, setPlayers] = useState<PlayerListItem[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(0);

    const { search, sort, order, limit, offset } = params;

    const fetchPlayers = useCallback(
        async (options: RefetchOptions = {}) => {
            const request = ++latest.current;
            const silent = options.silent === true;
            try {
                if (!silent) {
                    setLoading(true);
                    setError(null);
                }
                const res = await indexerApi.getPlayers({ search, sort, order, limit, offset });
                if (request !== latest.current) return;
                setPlayers(res?.data ?? []);
                setTotal(res?.pagination?.total ?? 0);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch players:", err);
                if (request !== latest.current || silent) return;
                setError(err instanceof Error ? err.message : "Failed to fetch players");
                setPlayers([]);
                setTotal(0);
            } finally {
                if (request === latest.current && !silent) setLoading(false);
            }
        },
        [indexerApi, search, sort, order, limit, offset]
    );

    useEffect(() => {
        fetchPlayers();
    }, [fetchPlayers]);

    return { players, total, loading, error, refetch: fetchPlayers };
}
