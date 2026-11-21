import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import { hasContent } from "../../utils/guards";
import { fetchAllPages } from "../../utils/pagedFetch";
import type { PlayerSession } from "../../types/players";
import type { SilentRefetchOptions } from "./usePlayerTournamentEntries";

interface UsePlayerSessionsResult {
    sessions: PlayerSession[];
    total: number;
    loading: boolean;
    error: string | null;
    refetch: (options?: SilentRefetchOptions) => void;
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

    return { sessions, total, loading, error, refetch: fetchSessions };
}

/**
 * Every session for the profile history, not one indexer page.
 * The game-type filter has to see the whole history; a page of 20 would hide
 * variants that only appear later. The indexer is still paged underneath.
 */
export function useAllPlayerSessions(address: string | undefined): UsePlayerSessionsResult {
    const indexerApi = useIndexerApi();
    const [sessions, setSessions] = useState<PlayerSession[]>([]);
    const [loading, setLoading] = useState<boolean>(hasContent(address));
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const fetchSessions = useCallback(
        async (options?: SilentRefetchOptions) => {
            const id = ++requestId.current;
            if (!hasContent(address)) {
                setSessions([]);
                setLoading(false);
                setError(null);
                return;
            }
            const silent = options?.silent === true;
            if (!silent) setLoading(true);
            setError(null);
            try {
                const rows = await fetchAllPages((limit, offset) => indexerApi.getPlayerSessions(address, limit, offset));
                if (id !== requestId.current) return;
                setSessions(rows);
            } catch (err) {
                if (id !== requestId.current) return;
                console.error("Failed to fetch player sessions:", err);
                setError(err instanceof Error ? err.message : "Failed to fetch player sessions");
                if (!silent) setSessions([]);
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        },
        [indexerApi, address]
    );

    useEffect(() => {
        void fetchSessions();
        return () => {
            requestId.current += 1;
        };
    }, [fetchSessions]);

    return { sessions, total: sessions.length, loading, error, refetch: fetchSessions };
}
