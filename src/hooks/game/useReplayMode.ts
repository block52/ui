import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { hasValue } from "../../utils/guards";

interface UseReplayModeReturn {
    isReplayMode: boolean;
    handNumber: number | null;
    actionIndex: number | null;
    clearReplayParams: () => void;
}

/**
 * Parses readonly share-link params from the URL.
 *
 * URL shapes:
 *   `/table/{tableId}?hand={handNumber}`                  the hand's final state
 *                                                         (showdown or last action)
 *   `/table/{tableId}?hand={handNumber}&index={actionIndex}`  a point in the CURRENT
 *                                                         hand (GameStateAt, pokerchain#160)
 *
 * `hand` alone enters read-only replay mode; `index` is optional.
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

    const isReplayMode = hasValue(handNumber);

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
