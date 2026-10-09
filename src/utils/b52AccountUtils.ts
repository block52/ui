/**
 * Utility functions for Block52 account management
 */

// NodeRpcClient removed from SDK - using CosmosClient instead
// import { NodeRpcClient } from "@block52/poker-vm-sdk";
import { hasValue } from "./guards";
import { truncateMiddle } from "./stringUtils";
import { STORAGE_KEYS } from "../constants/storageKeys";

// Singleton instance for NodeRpcClient (deprecated - kept for potential future use)
let clientInstance: unknown = null;

/**
 * Get the user's private key from browser storage
 * @returns The private key string or null if not found
 */
export const getPrivateKey = (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ethPrivateKey);
};

/**
 * Get the user's Cosmos address from browser storage
 * @returns The Cosmos address string or null if not found
 */
export const getPublicKey = (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.cosmosAddress);
};

/**
 * Get formatted address for display (shortened with ellipsis)
 * @returns Formatted address string like "0x1234...abcd" or empty string if no address
 */
export const getFormattedAddress = (length: number = 6): string => {
    return truncateMiddle(getPublicKey(), length, 4);
};

/**
 * Set the user's private key in browser storage
 * @param privateKey The private key to store
 */
export const setPrivateKey = (privateKey: string): void => {
    localStorage.setItem(STORAGE_KEYS.ethPrivateKey, privateKey);
    // Clear the client instance when private key changes
    clientInstance = null;
};

/**
 * Remove the user's private key from browser storage
 */
export const clearPrivateKey = (): void => {
    localStorage.removeItem(STORAGE_KEYS.ethPrivateKey);
    // Clear the client instance when private key is removed
    clientInstance = null;
};

/**
 * Check if a private key is available
 * @returns True if private key exists in storage
 */
export const hasPrivateKey = (): boolean => {
    return hasValue(getPrivateKey());
};
