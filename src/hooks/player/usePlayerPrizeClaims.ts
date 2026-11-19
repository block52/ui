import { useCallback, useEffect, useRef, useState } from "react";
import { httpErrorMessage } from "../../apis/HTTPClient";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { hasContent, hasValue } from "../../utils/guards";
import { isPrizeClaimAddress, prizeClaimsFromTxSearch, prizeClaimsQueryFor, type PlayerPrizeClaim } from "../../utils/playerPrizeClaims";
import type { SilentRefetchOptions } from "./usePlayerTournamentEntries";

interface UsePlayerPrizeClaimsResult {
    claims: PlayerPrizeClaim[];
    loading: boolean;
    /** Set when the chain query failed. Claims are empty so the page keeps the indexer figures. */
    error: string | null;
    refetch: (options?: SilentRefetchOptions) => void;
}

interface PrizeClaimState {
    address: string;
    claims: PlayerPrizeClaim[];
    error: string | null;
}

/**
 * Sit & Go and tournament prizes for one player, from the chain.
 *
 * The indexer only learns about cash-outs from player_left_game. A prize claim
 * emits sng_prize_claimed and leaves the session open at cash_out 0. This reads
 * the successful claims so the profile can fill those in. A failed query leaves
 * claims empty: the page falls back to the indexer and stays up.
 */
export function usePlayerPrizeClaims(address: string | undefined): UsePlayerPrizeClaimsResult {
    const cosmosApi = useCosmosApi();
    const [state, setState] = useState<PrizeClaimState | null>(null);
    const [loading, setLoading] = useState<boolean>(hasContent(address));
    const player = hasContent(address) ? address.toLowerCase() : undefined;
    const requestId = useRef(0);

    const fetchClaims = useCallback(
        async (options?: SilentRefetchOptions) => {
            const id = ++requestId.current;
            if (!hasContent(player)) {
                setState(null);
                setLoading(false);
                return;
            }
            if (!isPrizeClaimAddress(player)) {
                setState({ address: player, claims: [], error: "Invalid player address" });
                setLoading(false);
                return;
            }
            const silent = options?.silent === true;
            if (!silent) setLoading(true);
            try {
                const response = await cosmosApi.getAllTransactionsMatching(prizeClaimsQueryFor(player));
                if (id !== requestId.current) return;
                setState({ address: player, claims: prizeClaimsFromTxSearch(response, player), error: null });
            } catch (err) {
                if (id !== requestId.current) return;
                console.error("Failed to fetch prize claims:", err);
                setState(current => {
                    if (silent && hasValue(current) && current.address === player) {
                        return { ...current, error: httpErrorMessage(err, "Failed to fetch prize claims") };
                    }
                    return { address: player, claims: [], error: httpErrorMessage(err, "Failed to fetch prize claims") };
                });
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        },
        [cosmosApi, player]
    );

    useEffect(() => {
        void fetchClaims();
        return () => {
            requestId.current += 1;
        };
    }, [fetchClaims]);

    const ready = hasValue(state) && state.address === player;
    return {
        claims: ready ? state.claims : [],
        loading: hasContent(player) && (!ready || loading),
        error: ready ? state.error : null,
        refetch: fetchClaims
    };
}
