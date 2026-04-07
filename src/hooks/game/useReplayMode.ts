import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface UseReplayModeReturn {
    isReplayMode: boolean;
    blockNumber: number | null;
    actionIndex: number | null;
    clearReplayParams: () => void;
}

export const useReplayMode = (): UseReplayModeReturn => {
    const [searchParams, setSearchParams] = useSearchParams();

    const blockNumber = useMemo(() => {
        const param = searchParams.get("blocknumber");
        if (!param) return null;
        const parsed = Number(param);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);

    const actionIndex = useMemo(() => {
        const param = searchParams.get("actionindex");
        if (!param) return null;
        const parsed = Number(param);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }, [searchParams]);

    const isReplayMode = blockNumber !== null;

    const clearReplayParams = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("blocknumber");
        newParams.delete("actionindex");
        setSearchParams(newParams, { replace: true });
    };

    return {
        isReplayMode,
        blockNumber,
        actionIndex,
        clearReplayParams
    };
};
