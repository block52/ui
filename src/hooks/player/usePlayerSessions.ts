import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerSession, PlayerSessionFilter, SessionGameCount } from "@block52/poker-ui-core/types/players";
import type { RefetchOptions } from "../useVisibleRefresh";

interface UsePlayerSessionsResult {
    sessions: PlayerSession[];
    total: number;
    /** Sessions per format and variant across all of the player's sessions; undefined on an indexer from before ui#1012. */
    games: SessionGameCount[] | undefined;
    loading: boolean;
    error: string | null;
    refetch: (options?: RefetchOptions) => void;
}

/**
 * Fetches a page of a player's session history from the indexer (ui#589),
 * optionally at one format and variant (ui#1012). Only the latest request's
 * result is shown, so a slow refresh can't overwrite a newer page or filter.
 */
export function usePlayerSessions(address: string | undefined, limit: number, offset: number, filter: PlayerSessionFilter = {}): UsePlayerSessionsResult {
    const indexerApi = useIndexerApi();
    const [sessions, setSessions] = useState<PlayerSession[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [games, setGames] = useState<SessionGameCount[] | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(0);

    const { game_format, game_variant } = filter;

    const fetchSessions = useCallback(
        async (options: RefetchOptions = {}) => {
            const request = ++latest.current;
            const silent = options.silent === true;
            if (!address) {
                setSessions([]);
                setTotal(0);
                setGames(undefined);
                setLoading(false);
                return;
            }
            try {
                if (!silent) {
                    setLoading(true);
                    setError(null);
                }
                const res = await indexerApi.getPlayerSessions(address, limit, offset, { game_format, game_variant });
                if (request !== latest.current) return;
                setSessions(res?.data ?? []);
                setTotal(res?.pagination?.total ?? 0);
                setGames(res?.games);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch player sessions:", err);
                if (request !== latest.current || silent) return;
                setError(err instanceof Error ? err.message : "Failed to fetch player sessions");
                setSessions([]);
                setTotal(0);
            } finally {
                if (request === latest.current && !silent) setLoading(false);
            }
        },
        [indexerApi, address, limit, offset, game_format, game_variant]
    );

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    return { sessions, total, games, loading, error, refetch: fetchSessions };
}
