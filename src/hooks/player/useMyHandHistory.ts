import { useState, useEffect, useCallback, useRef } from "react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import { httpErrorMessage, isNetworkError } from "../../apis/HTTPClient";
import { isEmpty } from "../../utils/guards";
import { mergeHandPages } from "../../utils/handHistory";
import type { PlayerHand } from "../../types/players";

interface UseMyHandHistoryResult {
    hands: PlayerHand[];
    total: number;
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    /** The indexer list has been walked to its end for this wallet. */
    complete: boolean;
    loadMore: () => void;
    reload: () => void;
}

/**
 * The finished hands a wallet played, newest first (ui#721).
 *
 * Pages keep loading until the indexer's offset is exhausted. The offset
 * advances by how many rows the server returned, not by how many were new:
 * a page of duplicates must not pin the list to the same offset. `address`
 * and `networkKey` are the list's identity: changing either clears it and
 * starts again, and a reply for the previous identity is ignored.
 */
export function useMyHandHistory(address: string | null, networkKey: string, pageSize: number): UseMyHandHistoryResult {
    const indexerApi = useIndexerApi();
    const [hands, setHands] = useState<PlayerHand[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [nextOffset, setNextOffset] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [settled, setSettled] = useState<boolean>(false);
    // Bumped on every identity change or reload; a reply from an older generation is dropped.
    const generation = useRef(0);
    const inFlight = useRef(false);

    const fetchPage = useCallback(
        async (offset: number, gen: number) => {
            if (!address || inFlight.current) return;
            inFlight.current = true;
            try {
                setLoading(true);
                setError(null);
                const res = await indexerApi.getPlayerHands(address, pageSize, offset);
                if (gen !== generation.current) return;
                setHands(prev => (offset === 0 ? res.data : mergeHandPages(prev, res.data)));
                setTotal(res.pagination.total);
                setNextOffset(isEmpty(res.data) ? res.pagination.total : offset + res.data.length);
                setSettled(true);
            } catch (err) {
                if (gen !== generation.current) return;
                console.error("Failed to fetch hand history:", err);
                setError(
                    isNetworkError(err)
                        ? "The hand history service (indexer) can't be reached right now. Try again shortly."
                        : httpErrorMessage(err, "Failed to load hand history")
                );
            } finally {
                if (gen === generation.current) {
                    inFlight.current = false;
                    setLoading(false);
                }
            }
        },
        [indexerApi, address, pageSize]
    );

    const reload = useCallback(() => {
        generation.current += 1;
        inFlight.current = false;
        setHands([]);
        setTotal(0);
        setNextOffset(0);
        setError(null);
        setSettled(false);
        setLoading(false);
        fetchPage(0, generation.current);
    }, [fetchPage]);

    // A new wallet or network starts a new list.
    useEffect(() => {
        reload();
    }, [reload, networkKey]);

    // Keep going until every indexed page has been requested.
    useEffect(() => {
        if (!address || loading || error || !settled) return;
        if (nextOffset < total) fetchPage(nextOffset, generation.current);
    }, [address, loading, error, settled, nextOffset, total, fetchPage]);

    const loadMore = useCallback(() => {
        if (!address || loading || nextOffset >= total) return;
        fetchPage(nextOffset, generation.current);
    }, [address, fetchPage, loading, nextOffset, total]);

    const complete = Boolean(address) && settled && !loading && !error && nextOffset >= total;
    return { hands, total, loading, error, hasMore: nextOffset < total, complete, loadMore, reload };
}
