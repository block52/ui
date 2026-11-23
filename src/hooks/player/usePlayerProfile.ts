import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerProfile } from "@block52/poker-ui-core/types/players";
import type { RefetchOptions } from "../useVisibleRefresh";

interface UsePlayerProfileResult {
    profile: PlayerProfile | null;
    loading: boolean;
    error: string | null;
    refetch: (options?: RefetchOptions) => void;
}

/** Fetches a single player's full profile from the indexer (ui#589). Only the latest request's result is shown. */
export function usePlayerProfile(address: string | undefined): UsePlayerProfileResult {
    const indexerApi = useIndexerApi();
    const [profile, setProfile] = useState<PlayerProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(0);

    const fetchProfile = useCallback(
        async (options: RefetchOptions = {}) => {
            const request = ++latest.current;
            const silent = options.silent === true;
            if (!address) {
                setProfile(null);
                setLoading(false);
                return;
            }
            try {
                if (!silent) {
                    setLoading(true);
                    setError(null);
                }
                const res = await indexerApi.getPlayerProfile(address);
                if (request !== latest.current) return;
                setProfile(res ?? null);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch player profile:", err);
                if (request !== latest.current || silent) return;
                setError(err instanceof Error ? err.message : "Failed to fetch player profile");
                setProfile(null);
            } finally {
                if (request === latest.current && !silent) setLoading(false);
            }
        },
        [indexerApi, address]
    );

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile };
}
