import { useMemo } from "react";
import { ResultDTO, GameFormat } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";

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
        return allResults.length > 0;
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

            // Find the result for this player (case-insensitive)
            const result = allResults.find(
                r => r.playerId?.toLowerCase() === playerAddress.toLowerCase()
            );

            if (!result) return null;

            return {
                place: result.place,
                payout: result.payout, // Raw BigInt string - components format for display
                isWinner: result.place === 1
            };
        };
    }, [allResults, hasResults]);

    // Get result for a specific seat number
    const getSeatResult = useMemo(() => {
        return (seatNumber: number): PlayerResultData | null => {
            if (!seatNumber || !hasResults || !gameState?.players) return null;

            // Find the player at this seat
            const player = gameState.players.find(p => p.seat === seatNumber);
            if (!player?.address) return null;

            // Get the result for this player
            return getPlayerResult(player.address);
        };
    }, [gameState?.players, hasResults, getPlayerResult]);

    return {
        getPlayerResult,
        getSeatResult,
        allResults,
        hasResults,
        isSitAndGo
    };
};