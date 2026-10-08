import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import { httpErrorMessage, isNetworkError } from "../../apis/HTTPClient";
import { mergeHandPages } from "../../utils/handHistory";
import type { PlayerHand } from "../../types/players";

interface UseMyHandHistoryResult {
    hands: PlayerHand[];
    total: number;
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
    reload: () => void;
}

/**
 * The finished hands a wallet played, newest first, a page at a time (ui#721).
 *
 * `address` and `networkKey` are the list's identity: changing either clears
 * it and starts again, and a reply for the previous identity is ignored, so a
 * slow response can never show one wallet's hands under another.
 */
export function useMyHandHistory(address: string | null, networkKey: string, pageSize: number): UseMyHandHistoryResult {
    const indexerApi = useIndexerApi();
    const [hands, setHands] = useState<PlayerHand[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    // Bumped on every identity change or reload; a reply from an older generation is dropped.
    const generation = useRef(0);

    const fetchPage = useCallback(
        async (offset: number, gen: number) => {
            if (!address) return;
            try {
                setLoading(true);
                setError(null);
                const res = await indexerApi.getPlayerHands(address, pageSize, offset);
                if (gen !== generation.current) return;
                setHands(prev => (offset === 0 ? res.data : mergeHandPages(prev, res.data)));
                setTotal(res.pagination.total);
            } catch (err) {
                if (gen !== generation.current) return;
                console.error("Failed to fetch hand history:", err);
                setError(
                    isNetworkError(err)
                        ? "The hand history service (indexer) can't be reached right now. Try again shortly."
                        : httpErrorMessage(err, "Failed to load hand history")
                );
            } finally {
                if (gen === generation.current) setLoading(false);
            }
        },
        [indexerApi, address, pageSize]
    );

    const reload = useCallback(() => {
        generation.current += 1;
        setHands([]);
        setTotal(0);
        setError(null);
        setLoading(false);
        fetchPage(0, generation.current);
    }, [fetchPage]);

    // A new wallet or network starts a new list.
    useEffect(() => {
        reload();
    }, [reload, networkKey]);

    const loadMore = useCallback(() => {
        if (loading) return;
        fetchPage(hands.length, generation.current);
    }, [fetchPage, hands.length, loading]);

    return { hands, total, loading, error, hasMore: hands.length < total, loadMore, reload };
}
