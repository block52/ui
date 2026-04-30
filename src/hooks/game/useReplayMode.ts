import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface UseReplayModeReturn {
    isReplayMode: boolean;
    handNumber: number | null;
    actionIndex: number | null;
    clearReplayParams: () => void;
}

/**
 * Parses readonly share-link params from the URL.
 *
 * URL shape: `/table/{tableId}?hand={handNumber}&index={actionIndex}`
 *
 * Both params are required to enter replay mode. They drive the chain's
 * GameStateAt RPC (poker-vm#2025, pokerchain#160) to reconstruct a
 * point-in-time snapshot for social sharing.
 */
export const useReplayMode = (): UseReplayModeReturn => {
    const [searchParams, setSearchParams] = useSearchParams();

    const handNumber = useMemo(() => {
        const param = searchParams.get("hand");
        if (!param) return null;
        const parsed = Number(param);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);

    const actionIndex = useMemo(() => {
        const param = searchParams.get("index");
        if (!param) return null;
        const parsed = Number(param);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }, [searchParams]);

    const isReplayMode = handNumber !== null && actionIndex !== null;

    const clearReplayParams = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("hand");
        newParams.delete("index");
        setSearchParams(newParams, { replace: true });
    };

    return {
        isReplayMode,
        handNumber,
        actionIndex,
        clearReplayParams
    };
};
