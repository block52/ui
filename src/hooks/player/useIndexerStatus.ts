import { useState, useEffect } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { IndexerStatus } from "../../pages/explorer/types";

/**
 * The indexer's progress (last indexed block, % of the chain), so history pages
 * can say when a hand may simply not be indexed yet. Null until loaded or if
 * the status call fails; that failure is logged, not shown.
 */
export function useIndexerStatus(): IndexerStatus | null {
    const indexerApi = useIndexerApi();
    const [status, setStatus] = useState<IndexerStatus | null>(null);

    useEffect(() => {
        let cancelled = false;
        indexerApi
            .getSyncStatus()
            .then(res => {
                if (!cancelled) setStatus(res as IndexerStatus);
            })
            .catch(err => console.error("Failed to fetch indexer status:", err));
        return () => {
            cancelled = true;
        };
    }, [indexerApi]);

    return status;
}
