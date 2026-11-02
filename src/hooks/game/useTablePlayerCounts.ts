import { useState, useEffect, useMemo } from "react";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { PlayerDTO } from "@block52/poker-vm-sdk";
import { isEmpty, hasValue } from "../../utils/guards";

interface TablePlayerCount {
    tableId: string;
    currentPlayers: number;
    maxPlayers: number;
}

/**
 * Hook to fetch player counts for multiple tables from Cosmos blockchain
 *
 * Queries Cosmos REST API for game states to get player counts for the dashboard.
 * This hook does periodic polling of multiple tables for lobby display.
 *
 * @param tableAddresses Array of table/game IDs to fetch player counts for
 * @returns Map of table addresses to player counts
 */
export const useTablePlayerCounts = (tableAddresses: string[]) => {
    const [playerCounts, setPlayerCounts] = useState<Map<string, TablePlayerCount>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const cosmosApi = useCosmosApi();

    // Memoize the table addresses string to avoid unnecessary re-renders
    const tableAddressesKey = useMemo(() => tableAddresses.join(","), [tableAddresses]);

    useEffect(() => {
        const fetchPlayerCounts = async () => {
            if (isEmpty(tableAddresses)) return;

            setIsLoading(true);
            const newCounts = new Map<string, TablePlayerCount>();

            try {
                // Fetch game state for each table in parallel from Cosmos blockchain
                const promises = tableAddresses.map(async (gameId) => {
                    try {
                        // Query Cosmos REST API for game state
                        const data = await cosmosApi.getGameState(gameId) as { game_state?: string };

                        // Parse the game_state JSON string
                        if (data.game_state) {
                            const gameState = JSON.parse(data.game_state);

                            // Count non-null active players
                            const activePlayers = gameState.players?.filter((p: PlayerDTO | null) => hasValue(p)).length || 0;
                            const maxPlayers = gameState.gameOptions?.maxPlayers;

                            return {
                                tableId: gameId,
                                currentPlayers: activePlayers,
                                maxPlayers: maxPlayers
                            };
                        }

                        return {
                            tableId: gameId,
                            currentPlayers: 0,
                            maxPlayers: 0
                        };
                    } catch (error) {
                        console.error(`Error fetching player count for table ${gameId}:`, error);
                        return {
                            tableId: gameId,
                            currentPlayers: 0,
                            maxPlayers: 0
                        };
                    }
                });

                const results = await Promise.all(promises);

                // Convert to map
                results.forEach(result => {
                    newCounts.set(result.tableId, result);
                });

                setPlayerCounts(newCounts);
            } catch (error) {
                console.error("Error fetching player counts:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlayerCounts();

        // Refresh every 10 seconds
        const interval = setInterval(fetchPlayerCounts, 10000);

        return () => clearInterval(interval);
    }, [tableAddresses, tableAddressesKey, cosmosApi]); // Re-run when table list changes

    return { playerCounts, isLoading };
};
