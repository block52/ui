import { useState, useEffect, useCallback } from "react";
import { GameListItem } from "@block52/poker-vm-sdk";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { GameWithFormat, convertGameList } from "../../utils/convertUtils";

export type { GameWithFormat };

export const treasuryAddress = import.meta.env.VITE_TREASURY_WALLET_ADDRESS || "";

export interface FindGamesReturn {
    games: GameWithFormat[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to find available games from Cosmos blockchain
 * @returns Object containing available games and loading state
 */
export const useFindGames = (): FindGamesReturn => {
    const [games, setGames] = useState<GameWithFormat[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const { currentNetwork } = useNetwork();

    const fetchGames = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const cosmosClient = getCosmosClient(currentNetwork);
            if (!cosmosClient) {
                throw new Error("Block52 client not initialized. Please create or import a Block52 wallet first.");
            }

            // Fetch all games from Cosmos REST API
            const cosmosGames: GameListItem[] = await cosmosClient.findGames();

            // Convert SDK types to UI types, filtering out invalid entries
            const availableGames: GameWithFormat[] = convertGameList(cosmosGames);
            setGames(availableGames);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch games from Cosmos";
            setError(new Error(errorMessage));
            console.error("Error fetching games from Cosmos:", err);
        } finally {
            setIsLoading(false);
        }
    }, [currentNetwork]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    return {
        games,
        isLoading,
        error,
        refetch: fetchGames
    };
};
