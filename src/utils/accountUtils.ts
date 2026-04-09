import { ethers } from "ethers";
import { formatMicroAsUsdc } from "../constants/currency";

/**
 * Get public key from private key
 * @param privateKey The private key
 * @returns The uncompressed public key
 */
export const getPublicKey = (privateKey: string): string => {
    try {
        const wallet = new ethers.Wallet(privateKey);
        return wallet.signingKey.publicKey;
    } catch (error) {
        console.error("Error getting public key:", error);
        throw new Error("Failed to get public key");
    }
};

/**
 * Format player ID for display
 * @param playerId The player's ID or address
 * @returns Formatted string with first 6 and last 4 characters
 */
export const formatPlayerId = (playerId: string): string => {
    return `${playerId.slice(0, 6)}...${playerId.slice(-4)}`;
};

/**
 * Format amount from micro-units to display format
 * Delegates to the centralized formatMicroAsUsdc helper for consistent formatting.
 * @param amount The amount in micro-units (6 decimals)
 * @param denom Optional denomination (e.g., "usdc"). If provided, appends uppercase denom instead of $ prefix.
 * @returns Formatted string (e.g., "$1.50" or "1.50 USDC")
 */
export const formatAmount = (amount: string, denom?: string, isTournament?: boolean): string => {
    if (isTournament) {
        // Tournament/SNG: raw chip values, no USDC conversion
        return `${Number(amount).toLocaleString()} chips`;
    }
    const formatted = formatMicroAsUsdc(amount, 2);
    if (denom) {
        // Remove "u" prefix for Cosmos micro-denominations (e.g., "uusdc" -> "USDC")
        const displayDenom = denom.startsWith("u") ? denom.slice(1) : denom;
        return `${formatted} ${displayDenom.toUpperCase()}`;
    }
    return `$${formatted}`;
};
