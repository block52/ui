import { useCallback, useEffect, useRef, useState } from "react";
import { httpErrorMessage, isNetworkError } from "../../apis/HTTPClient";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerHand, PlayerListItem, PlayerProfile } from "../../types/players";
import { hasValue, isEmpty } from "../../utils/guards";
import { fetchAllPages, mapWithConcurrency } from "../../utils/pagedFetch";
import { computeAwards, handsWithRecordedWinner, MIN_AWARD_DECISIONS, PlayerAward, rankedLines, toAwardLine } from "../../utils/playerAwards";

/** Wallets read at once. Each one is a hands request and, if it could qualify, a stats request. */
const MAX_CONCURRENT_WALLETS = 4;

interface WalletData {
    /** Null for a wallet too small to qualify: decisions are a subset of recorded actions. */
    profile: PlayerProfile | null;
    hands: PlayerHand[];
}

interface UsePlayerAwardsResult {
    awards: PlayerAward[];
    /** Wallets with enough decisions to be ranked. */
    rankedPlayers: number;
    /** Wallets whose data couldn't be read, so an award could be wrong. */
    failedPlayers: number;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * The player awards, computed in the browser from the indexer's public API.
 *
 * Every wallet's hands are read, even one too small to win anything: it may have
 * won a hand against a wallet that can.
 */
export function usePlayerAwards(): UsePlayerAwardsResult {
    const indexerApi = useIndexerApi();
    const [awards, setAwards] = useState<PlayerAward[]>([]);
    const [rankedPlayers, setRankedPlayers] = useState<number>(0);
    const [failedPlayers, setFailedPlayers] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    // Bumped on every load and on unmount; a reply from an older generation is dropped.
    const generation = useRef(0);

    const readWallet = useCallback(
        async (player: PlayerListItem): Promise<WalletData | null> => {
            const address = player.player_address;
            try {
                const [profile, hands] = await Promise.all([
                    player.total_actions >= MIN_AWARD_DECISIONS ? indexerApi.getPlayerProfile(address) : null,
                    fetchAllPages((limit, offset) => indexerApi.getPlayerHands(address, limit, offset))
                ]);
                return { profile, hands };
            } catch (err) {
                console.error(`Failed to read awards data for ${address}:`, err);
                return null;
            }
        },
        [indexerApi]
    );

    const refetch = useCallback(async () => {
        generation.current += 1;
        const gen = generation.current;
        setLoading(true);
        setError(null);
        try {
            const players = await fetchAllPages((limit, offset) => indexerApi.getPlayers({ limit, offset }));
            const results = await mapWithConcurrency(players, MAX_CONCURRENT_WALLETS, readWallet);
            if (gen !== generation.current) return;

            const wallets = results.filter(hasValue);
            const failed = results.length - wallets.length;
            if (failed > 0 && isEmpty(wallets)) {
                throw new Error("The indexer couldn't return any player stats.");
            }
            const withWinner = handsWithRecordedWinner(wallets.flatMap(wallet => wallet.hands));
            const lines = wallets.flatMap(({ profile, hands }) => (hasValue(profile) ? [toAwardLine(profile, hands, withWinner)] : []));
            setAwards(computeAwards(lines));
            setRankedPlayers(rankedLines(lines).length);
            setFailedPlayers(failed);
        } catch (err) {
            if (gen !== generation.current) return;
            console.error("Failed to load player awards:", err);
            setAwards([]);
            setRankedPlayers(0);
            setFailedPlayers(0);
            setError(
                isNetworkError(err) ? "The stats service (indexer) can't be reached right now. Try again shortly." : httpErrorMessage(err, "Failed to load the awards")
            );
        } finally {
            if (gen === generation.current) setLoading(false);
        }
    }, [indexerApi, readWallet]);

    useEffect(() => {
        refetch();
        return () => {
            generation.current += 1;
        };
    }, [refetch]);

    return { awards, rankedPlayers, failedPlayers, loading, error, refetch };
}
