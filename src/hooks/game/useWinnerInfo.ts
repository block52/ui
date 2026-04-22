import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerDTO, TexasHoldemStateDTO, WinnerDTO } from "@block52/poker-vm-sdk";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { WinnerInfo, WinnerInfoReturn } from "../../types/index";

/**
 * Extract winner information from game state
 * @param gameData The parsed game data
 * @returns Array of winner information or null if no winners
 */
function getWinnerInfo(gameData: TexasHoldemStateDTO) {
    if (!gameData) return null;

    // Check for explicit winners array in the game data
    if (gameData.winners && gameData.winners.length > 0) {
        return gameData.winners.map((winner: WinnerDTO) => {
            // Get the player object for this winner to find their seat
            const player = gameData.players?.find((p: PlayerDTO) => p.address?.toLowerCase() === winner.address?.toLowerCase());

            return {
                seat: player?.seat || 0,
                address: winner.address,
                amount: winner.amount.toString(),
                formattedAmount: formatUSDCToSimpleDollars(winner.amount.toString()),
                winType: "showdown",
                description: winner.description,
                handName: winner.name,
                cards: winner.cards
            };
        });
    }

    // No winners yet
    return null;
}

/**
 * Custom hook to fetch and provide winner information
 * @param tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing winner information
 */
export const useWinnerInfo = (): WinnerInfoReturn => {
    // Get game state directly from Context - no additional WebSocket connections
    const { gameState, isLoading, error } = useGameStateContext();

    // Default values in case of error or loading
    const defaultState: WinnerInfoReturn = {
        winnerInfo: null as WinnerInfo[] | null,
        error
    };

    // If still loading or error occurred, return default values
    if (isLoading || error || !gameState) {
        return defaultState;
    }

    try {
        // Process winner information
        const winners = getWinnerInfo(gameState);
        const result: WinnerInfoReturn = {
            winnerInfo: winners,
            error: null
        };

        return result;
    } catch (err) {
        console.error("Error parsing winner information:", err);
        return {
            ...defaultState,
        };
    }
};
