/**
 * Cosmos query signing utilities
 *
 * Implements the same signing pattern as poker-cli for authenticated queries.
 * Used to prove player identity when requesting hole cards via WebSocket.
 *
 * Message format: "pokerchain-query:<timestamp>"
 * Signature format: Ethereum personal_sign (EIP-191)
 */

import { ethers } from "ethers";
import { getCosmosMnemonic } from "./storage";
import { STORAGE_KEYS } from "../../constants/storageKeys";

// Cosmos HD derivation path (same as poker-cli uses: sdk.GetConfig().GetFullBIP44Path())
const COSMOS_HD_PATH = "m/44'/118'/0'/0/0";

/**
 * Signs a query message with the user's mnemonic for WebSocket authentication.
 *
 * The signature allows the WebSocket server to verify the player's identity
 * and return their hole cards while masking other players' cards.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns The hex-encoded signature with 0x prefix, or null if no mnemonic
 */
export async function signQueryMessage(timestamp: number): Promise<string | null> {
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found in storage");
        return null;
    }

    try {
        // Create message in the same format as poker-cli
        const message = `pokerchain-query:${timestamp}`;

        // Derive wallet from mnemonic using COSMOS HD path (m/44'/118'/0'/0/0)
        // This matches the key derivation used in poker-cli and Cosmos SDK
        // Note: ethers.js v6 uses HDNodeWallet for custom derivation paths
        const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, COSMOS_HD_PATH);

        // Sign the message - ethers.js automatically adds the Ethereum personal_sign prefix:
        // "\x19Ethereum Signed Message:\n<length><message>"
        const signature = await hdWallet.signMessage(message);

        return signature;
    } catch (error) {
        console.error("[signing] Failed to sign query message:", error);
        return null;
    }
}

/**
 * Creates a signed authentication payload for WebSocket subscription.
 *
 * @returns Authentication payload with address, timestamp, and signature, or null if signing fails
 */
export async function createAuthPayload(): Promise<{
    playerAddress: string;
    timestamp: number;
    signature: string;
} | null> {
    const mnemonic = getCosmosMnemonic();
    if (!mnemonic) {
        console.error("[signing] No mnemonic found for auth payload");
        return null;
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signQueryMessage(timestamp);

        if (!signature) {
            return null;
        }

        // Get the Cosmos address from storage (already derived during wallet creation)
        const cosmosAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress);
        if (!cosmosAddress) {
            console.error("[signing] No Cosmos address found in storage");
            return null;
        }

        return {
            playerAddress: cosmosAddress,
            timestamp,
            signature
        };
    } catch (error) {
        console.error("[signing] Failed to create auth payload:", error);
        return null;
    }
}
