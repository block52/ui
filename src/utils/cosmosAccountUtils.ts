/**
 * Utility functions for Cosmos account management
 * Replaces b52AccountUtils.ts for Cosmos blockchain integration
 */

import { getCosmosClient } from "./cosmos/client";
import type { NetworkEndpoints } from "./cosmos/urls";

/**
 * Get the user's Cosmos address from the initialized client
 * @param network - The network endpoints to use
 * @returns The Cosmos address (b52...) or null if not found
 */
export const getCosmosAddress = async (network: NetworkEndpoints): Promise<string | null> => {
    const client = getCosmosClient(network);
    if (!client) return null;

    try {
        const address = await client.getWalletAddress();
        return address;
    } catch (error) {
        console.error("Error getting Cosmos address:", error);
        return null;
    }
};

/**
 * Synchronous version that gets address from localStorage
 * @returns The Cosmos address from localStorage or null
 */
export const getCosmosAddressSync = (): string | null => {
    // Get from localStorage using the correct key (see utils/cosmos/storage.ts)
    return localStorage.getItem("user_cosmos_address") || null;
};

/**
 * Get formatted Cosmos address for display (shortened with ellipsis)
 * @param length Number of characters to show at start (default 6)
 * @returns Formatted address string like "b521rg...fj9p" or empty string if no address
 */
export const getFormattedCosmosAddress = (length: number = 6): string => {
    const address = getCosmosAddressSync();
    if (!address) return "";
    return `${address.slice(0, length)}...${address.slice(-4)}`;
};

/**
 * Check if a Cosmos wallet is connected
 * @returns True if Cosmos client is initialized and has an address
 */
export const hasCosmosWallet = (): boolean => {
    const address = getCosmosAddressSync();
    return !!address;
};

/**
 * Get Cosmos account balance for specific token
 * @param network - The network endpoints to use
 * @param denom The token denomination to query (default: "usdc")
 * @returns Promise with the account balance as string in microunits (6 decimals)
 * @throws Error if wallet is not connected or fetch fails
 */
export const getCosmosBalance = async (network: NetworkEndpoints, denom: string = "usdc"): Promise<string> => {
    const client = getCosmosClient(network);

    if (!client) {
        throw new Error("No Block52 wallet connected. Please create or import a wallet first.");
    }

    // Get address from localStorage instead of client.getWalletAddress() (which doesn't work in REST-only mode)
    const address = getCosmosAddressSync();
    if (!address) {
        throw new Error("No Block52 address found. Please create or import a wallet first.");
    }

    try {

        // getBalance returns bigint directly
        const balance = await client.getBalance(address, denom);


        return balance.toString();
    } catch (error) {
        console.error("❌ Error fetching Cosmos balance:", error);
        throw new Error(`Failed to fetch Block52 balance: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
};
