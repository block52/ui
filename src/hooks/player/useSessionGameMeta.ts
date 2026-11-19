import { useEffect, useMemo, useState } from "react";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { hasContent } from "../../utils/guards";
import { mapWithConcurrency } from "../../utils/pagedFetch";
import { uniqueGameIds } from "../../utils/sessionGameDisplay";
import { fetchGamePrizeMeta, type GamePrizeMeta } from "../../utils/transactionUtils";

interface UseSessionGameMetaResult {
    /** Game id → parsed record. Empty until this id set has settled, including failures. */
    byId: Record<string, GamePrizeMeta>;
    loading: boolean;
}

/**
 * Format, variant, stakes and results for the session table's games.
 *
 * One getGame per id, shared with the explorer through fetchGamePrizeMeta's
 * cache, so a re-render does not ask again. Lookups run a few at a time.
 * A game the chain no longer has comes back empty and the row keeps its address.
 */
export function useSessionGameMeta(gameIds: string[]): UseSessionGameMetaResult {
    const cosmosApi = useCosmosApi();
    const ids = useMemo(() => uniqueGameIds(gameIds), [gameIds]);
    const key = ids.join("\n");
    const [byId, setById] = useState<Record<string, GamePrizeMeta>>({});
    const [loadedKey, setLoadedKey] = useState<string | null>(null);

    useEffect(() => {
        if (!hasContent(key)) {
            setById({});
            setLoadedKey(key);
            return;
        }
        let cancelled = false;
        const pending = key.split("\n");
        mapWithConcurrency(pending, 6, async id => {
            const meta = await fetchGamePrizeMeta(gameId => cosmosApi.getGame(gameId), [id]);
            return [id, meta[id] ?? {}] as const;
        })
            .then(entries => {
                if (cancelled) return;
                setById(Object.fromEntries(entries));
                setLoadedKey(key);
            })
            .catch(err => {
                if (cancelled) return;
                console.error("Failed to load session games:", err);
                setById({});
                setLoadedKey(key);
            });
        return () => {
            cancelled = true;
        };
    }, [cosmosApi, key]);

    const ready = loadedKey === key;
    return { byId: ready ? byId : {}, loading: !ready };
}
