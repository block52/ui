/**
 * useDeleteGame - Hook for deleting a poker game/table
 *
 * Only the game creator can delete a game, and the game must have no active players.
 * Uses SigningCosmosClient.deleteGame() from the SDK.
 */

import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNetwork } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";

interface UseDeleteGameReturn {
    deleteGame: (gameId: string) => Promise<string | null>;
    isDeleting: boolean;
    error: Error | null;
}

export const useDeleteGame = (): UseDeleteGameReturn => {
    const { currentNetwork } = useNetwork();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteGame = useCallback(
        async (gameId: string): Promise<string | null> => {
            setIsDeleting(true);
            setError(null);

            try {
                const { signingClient } = await getSigningClient(currentNetwork);

                console.log("🗑️ Deleting game:", gameId);

                const txHash = await signingClient.deleteGame(gameId);

                console.log("✅ Game deleted successfully:", txHash);
                toast.success("Table deleted successfully!");

                return txHash;
            } catch (err: any) {
                console.error("❌ Failed to delete game:", err);
                const message = err.message || "Failed to delete table";
                setError(new Error(message));
                toast.error(message);
                return null;
            } finally {
                setIsDeleting(false);
            }
        },
        [currentNetwork]
    );

    return { deleteGame, isDeleting, error };
};

export default useDeleteGame;
