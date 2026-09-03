import { useState, useEffect, useCallback } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerListItem, PlayerSearchParams } from "../../types/players";

interface UsePlayersDirectoryResult {
    players: PlayerListItem[];
    total: number;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Fetches a page of the searchable player directory from the indexer (ui#589).
 * The caller owns the search/sort/order/pagination state and passes it in;
 * this hook refetches whenever those params change.
 */
export function usePlayersDirectory(params: PlayerSearchParams): UsePlayersDirectoryResult {
    const indexerApi = useIndexerApi();
    const [players, setPlayers] = useState<PlayerListItem[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const { search, sort, order, limit, offset } = params;

    const fetchPlayers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await indexerApi.getPlayers({ search, sort, order, limit, offset });
            setPlayers(res?.data ?? []);
            setTotal(res?.pagination?.total ?? 0);
        } catch (err) {
            console.error("Failed to fetch players:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch players");
            setPlayers([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [indexerApi, search, sort, order, limit, offset]);

    useEffect(() => {
        fetchPlayers();
    }, [fetchPlayers]);

    return { players, total, loading, error, refetch: fetchPlayers };
}
