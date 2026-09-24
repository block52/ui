import { useMemo } from "react";
import { ResultDTO, GameFormat } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { usePlayersBySeat } from "./usePlayersBySeat";
import { hasElements } from "../../utils/guards";

// Hook return type for individual player result
export interface PlayerResultData {
    place: number;
    payout: string; // Raw BigInt string - components format for display
    isWinner: boolean;
}

// Hook return type
export interface SitAndGoPlayerResultsReturn {
    // Get result for a specific player address
    getPlayerResult: (playerAddress: string) => PlayerResultData | null;
    // Get result for a specific seat
    getSeatResult: (seatNumber: number) => PlayerResultData | null;
    // All results
    allResults: ResultDTO[];
    // Check if game has ended
    hasResults: boolean;
    // Check if it's a sit and go game
    isSitAndGo: boolean;
}

/**
 * Hook to get Sit & Go tournament results for players
 * Maps tournament results to player seats and provides formatted payout information
 */
export const useSitAndGoPlayerResults = (): SitAndGoPlayerResultsReturn => {
    const { gameState, gameFormat } = useGameStateContext();
    const playersBySeat = usePlayersBySeat();

    // Check if it's a sit and go game
    const isSitAndGo = useMemo(() => {
        return gameFormat === GameFormat.SIT_AND_GO;
    }, [gameFormat]);

    // Get all results
    const allResults = useMemo(() => {
        return gameState?.results || [];
    }, [gameState?.results]);

    // Check if game has results
    const hasResults = useMemo(() => {
        return hasElements(allResults);
    }, [allResults]);

    // Address -> result index, built once per results change (#704).
    //
    // These memos return FUNCTIONS, so what they cache is the closure, not the
    // lookup. Every seat calls getSeatResult on each render, and its identity
    // churns whenever gameState.players does — a fresh array on every
    // WebSocket frame — so a scan here runs per seat, per frame. Indexing makes
    // each call O(1) instead of a seat scan nested inside a results scan.
    //
    // Keys are lowercased, matching the case-insensitive comparison this
    // replaced; lookups must lowercase too.
    const resultsByAddress = useMemo(() => {
        const byAddress = new Map<string, ResultDTO>();
        for (const result of allResults) {
            if (result.playerId) {
                byAddress.set(result.playerId.toLowerCase(), result);
            }
        }
        return byAddress;
    }, [allResults]);

    // Get result for a specific player address.
    //
    // ONLY reads from gameState.results (tournament-final placements),
    // never synthesizes a place from gameState.winners (per-hand winner).
    // Conflating the two used to render "1st Place" overlays on hand
    // winners mid-tournament — when winners[] was populated but the
    // player wasn't yet in results[]. See test file's REGRESSION block.
    const getPlayerResult = useMemo(() => {
        return (playerAddress: string): PlayerResultData | null => {
            if (!playerAddress || !hasResults) return null;

            const result = resultsByAddress.get(playerAddress.toLowerCase());

            if (!result) return null;

            return {
                place: result.place,
                payout: result.payout, // Raw BigInt string - components format for display
                isWinner: result.place === 1
            };
        };
    }, [resultsByAddress, hasResults]);

    // Get result for a specific seat number
    const getSeatResult = useMemo(() => {
        return (seatNumber: number): PlayerResultData | null => {
            if (!seatNumber || !hasResults) return null;

            // Seat -> player comes from the shared index, not a fresh scan
            const player = playersBySeat.get(seatNumber);
            if (!player?.address) return null;

            // Get the result for this player
            return getPlayerResult(player.address);
        };
    }, [playersBySeat, hasResults, getPlayerResult]);

    return {
        getPlayerResult,
        getSeatResult,
        allResults,
        hasResults,
        isSitAndGo
    };
};