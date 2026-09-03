import { useState, useEffect, useCallback } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerProfile } from "../../types/players";

interface UsePlayerProfileResult {
    profile: PlayerProfile | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/** Fetches a single player's full profile from the indexer (ui#589). */
export function usePlayerProfile(address: string | undefined): UsePlayerProfileResult {
    const indexerApi = useIndexerApi();
    const [profile, setProfile] = useState<PlayerProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        if (!address) {
            setProfile(null);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const res = await indexerApi.getPlayerProfile(address);
            setProfile(res ?? null);
        } catch (err) {
            console.error("Failed to fetch player profile:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch player profile");
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, [indexerApi, address]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile };
}
