import { useState } from "react";
import { getSigningClient } from "../../utils/cosmos/client";
import type { NetworkEndpoints } from "../../context/NetworkContext";

/**
 * Result of a successful top-up transaction
 */
export interface TopUpResult {
    hash: string;
    gameId: string;
    amount: string; // Amount in microunits
}

/**
 * Hook for table top-up functionality
 *
 * Allows a player to add chips to their stack when not in an active hand.
 * Player must be seated at the table and have sufficient wallet balance.
 * Total chips after top-up cannot exceed the table's max_buy_in.
 */
export const useTableTopUp = (tableId: string, network: NetworkEndpoints) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Top up player's stack at the table
     * @param amountMicrounits - Amount to add in USDC microunits (e.g., "5000000" for $5)
     * @returns Transaction result with hash and amount
     */
    const topUp = async (amountMicrounits: string): Promise<TopUpResult> => {
        setLoading(true);
        setError(null);

        try {
            if (!tableId) {
                throw new Error("Table ID is required for top-up");
            }

            const { signingClient } = await getSigningClient(network);

            // Amount is already in microunits from the modal
            const topUpAmount = BigInt(amountMicrounits);

            if (topUpAmount <= 0n) {
                throw new Error("Invalid top-up amount. Must be a positive number.");
            }

            // Call SigningCosmosClient.topUp()
            const transactionHash = await signingClient.topUp(tableId, topUpAmount);


            return {
                hash: transactionHash,
                gameId: tableId,
                amount: topUpAmount.toString()
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to top up";
            console.error("❌ Top-up failed:", errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { topUp, loading, error };
};
