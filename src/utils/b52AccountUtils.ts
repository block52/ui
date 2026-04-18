/**
 * Utility functions for Block52 account management
 */

// NodeRpcClient removed from SDK - using CosmosClient instead
// import { NodeRpcClient } from "@block52/poker-vm-sdk";

// Singleton instance for NodeRpcClient (deprecated - kept for potential future use)
let clientInstance: unknown = null;

/**
 * Get the user's private key from browser storage
 * @returns The private key string or null if not found
 */
export const getPrivateKey = (): string | null => {
    return localStorage.getItem("user_eth_private_key");
};

/**
 * Get the user's Cosmos address from browser storage
 * @returns The Cosmos address string or null if not found
 */
export const getPublicKey = (): string | null => {
    return localStorage.getItem("user_cosmos_address");
};

/**
 * Get formatted address for display (shortened with ellipsis)
 * @returns Formatted address string like "0x1234...abcd" or empty string if no address
 */
export const getFormattedAddress = (length: number = 6): string => {
    const pubKey = getPublicKey();
    if (!pubKey) return "";
    return `${pubKey.slice(0, length)}...${pubKey.slice(-4)}`;
};

/**
 * Set the user's private key in browser storage
 * @param privateKey The private key to store
 */
export const setPrivateKey = (privateKey: string): void => {
    localStorage.setItem("user_eth_private_key", privateKey);
    // Clear the client instance when private key changes
    clientInstance = null;
};

/**
 * Remove the user's private key from browser storage
 */
export const clearPrivateKey = (): void => {
    localStorage.removeItem("user_eth_private_key");
    // Clear the client instance when private key is removed
    clientInstance = null;
};

/**
 * Check if a private key is available
 * @returns True if private key exists in storage
 */
export const hasPrivateKey = (): boolean => {
    return getPrivateKey() !== null;
};

/**
 * Get singleton NodeRpcClient instance
 * @returns NodeRpcClient instance
 * @throws Error if private key is missing
 * @deprecated Use CosmosClient from WithdrawalDashboard instead
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getClient = (): any => {
    // This function is deprecated and always throws
    throw new Error("NodeRpcClient deprecated - use CosmosClient from WithdrawalDashboard instead");
};

/**
 * Clear the client instance (useful when private key changes or for testing)
 */
export const clearClientInstance = (): void => {
    clientInstance = null;
};

/**
 * Get account balance directly from the blockchain
 * @returns Promise with the account balance as string
 * @throws Error if private key or public key is missing, or if the fetch fails
 */
export const getAccountBalance = async (): Promise<string> => {
    const publicKey = getPublicKey();
    
    if (!publicKey) {
        throw new Error("No public key found. Please connect your wallet first.");
    }

    // Use singleton client instance - disabled until migration
    // const client = getClient();
    // const account = await client.getAccount(publicKey);
    // return account.balance.toString();
    throw new Error("getAccountBalance deprecated - use CosmosClient.queryBalance() instead");
};
