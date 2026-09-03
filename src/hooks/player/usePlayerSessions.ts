import { useState, useEffect, useCallback } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerSession } from "../../types/players";

interface UsePlayerSessionsResult {
    sessions: PlayerSession[];
    total: number;
    loading: boolean;
    error: string | null;
}

/** Fetches a page of a player's session history from the indexer (ui#589). */
export function usePlayerSessions(address: string | undefined, limit: number, offset: number): UsePlayerSessionsResult {
    const indexerApi = useIndexerApi();
    const [sessions, setSessions] = useState<PlayerSession[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        if (!address) {
            setSessions([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const res = await indexerApi.getPlayerSessions(address, limit, offset);
            setSessions(res?.data ?? []);
            setTotal(res?.pagination?.total ?? 0);
        } catch (err) {
            console.error("Failed to fetch player sessions:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch player sessions");
            setSessions([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [indexerApi, address, limit, offset]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    return { sessions, total, loading, error };
}
