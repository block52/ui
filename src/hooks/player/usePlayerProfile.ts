import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerProfile } from "../../types/players";
import type { SilentRefetchOptions } from "./usePlayerTournamentEntries";

interface UsePlayerProfileResult {
    profile: PlayerProfile | null;
    loading: boolean;
    error: string | null;
    refetch: (options?: SilentRefetchOptions) => void;
}

/** Fetches a single player's full profile from the indexer (ui#589). */
export function usePlayerProfile(address: string | undefined): UsePlayerProfileResult {
    const indexerApi = useIndexerApi();
    const [profile, setProfile] = useState<PlayerProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const requestId = useRef(0);

    const fetchProfile = useCallback(async (options?: SilentRefetchOptions) => {
        const id = ++requestId.current;
        if (!address) {
            setProfile(null);
            setLoading(false);
            return;
        }
        const silent = options?.silent === true;
        try {
            if (!silent) setLoading(true);
            setError(null);
            const res = await indexerApi.getPlayerProfile(address);
            if (id !== requestId.current) return;
            setProfile(res ?? null);
        } catch (err) {
            if (id !== requestId.current) return;
            console.error("Failed to fetch player profile:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch player profile");
            if (!silent) setProfile(null);
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, [indexerApi, address]);

    useEffect(() => {
        void fetchProfile();
        return () => {
            requestId.current += 1;
        };
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile };
}
