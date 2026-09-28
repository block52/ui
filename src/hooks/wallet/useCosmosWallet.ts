/**
 * useCosmosWallet - Temporary replacement hook
 *
 * This provides basic Cosmos wallet functionality using localStorage
 * and the SDK directly, without using CosmosContext.
 *
 * TODO: Replace with proper hooks in /src/hooks/cosmos/ after SDK testing is complete
 */

import { useState, useEffect, useCallback } from "react";
import { getCosmosClient, getSigningClient } from "../../utils/cosmos/client";
import { getCosmosMnemonic, getCosmosAddress, setCosmosMnemonic, setCosmosAddress } from "../../utils/cosmos/storage";
import { getAddressFromMnemonic } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";

interface Balance {
    denom: string;
    amount: string;
}

interface UseCosmosWalletReturn {
    address: string | null;
    balance: Balance[];
    isLoading: boolean;
    error: string | null;
    refreshBalance: () => Promise<void>;
    importSeedPhrase: (mnemonic: string) => Promise<void>;
    sendTokens: (recipient: string, amount: bigint | string, denom?: string) => Promise<string>;
}

export const useCosmosWallet = (): UseCosmosWalletReturn => {
    const { currentNetwork } = useNetwork();
    const [address, setAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<Balance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load address from mnemonic
    useEffect(() => {
        const loadAddress = async () => {
            const mnemonic = getCosmosMnemonic();
            if (!mnemonic) {
                setAddress(null);
                return;
            }

            try {
                const addr = await getAddressFromMnemonic(mnemonic, "b52");
                setAddress(addr);
            } catch (err) {
                console.error("Error loading Cosmos address:", err);
                setAddress(null);
            }
        };

        loadAddress();
    }, []);

    // Refresh balance
    const refreshBalance = useCallback(async () => {
        if (!address) return;

        setIsLoading(true);
        setError(null);

        try {
            const client = getCosmosClient(currentNetwork);
            if (!client) {
                throw new Error("Block52 client not initialized");
            }

            const balances = await client.getAllBalances(address);
            setBalance(balances);
        } catch (err) {
            console.error("Error fetching balance:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch balance");
        } finally {
            setIsLoading(false);
        }
    }, [address, currentNetwork]);

    // Auto-refresh balance when address changes
    useEffect(() => {
        if (address) {
            refreshBalance();
        }
    }, [address, refreshBalance]);

    // Import seed phrase
    const importSeedPhrase = useCallback(async (mnemonic: string) => {
        setIsLoading(true);
        setError(null);

        try {
            // Get address from mnemonic
            const addr = await getAddressFromMnemonic(mnemonic, "b52");

            // Store mnemonic AND address in localStorage
            setCosmosMnemonic(mnemonic);
            setCosmosAddress(addr);

            // Verify storage worked
            const verifyMnemonic = getCosmosMnemonic();
            const verifyAddress = getCosmosAddress();

            // Update state
            setAddress(addr);
        } catch (err) {
            console.error("Error importing seed phrase:", err);
            setError(err instanceof Error ? err.message : "Failed to import seed phrase");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Send tokens using SigningCosmosClient
    const sendTokens = useCallback(async (recipient: string, amount: bigint | string, denom: string = "usdc"): Promise<string> => {
        if (!address) {
            throw new Error("No wallet connected");
        }

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            // Convert amount to BigInt if it's a string
            const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;

            // Send tokens - use the provided denom (usdc or stake)
            const txHash = await signingClient.sendTokens(
                address,        // from address
                recipient,      // to address
                amountBigInt,   // amount in micro-units as BigInt
                denom,          // denom (usdc or stake)
                `Transfer ${denom.toUpperCase()} via Dashboard`  // memo
            );


            // Refresh balance after sending
            await refreshBalance();

            return txHash;
        } catch (err) {
            console.error(`❌ Failed to send ${denom}:`, err);
            throw new Error(err instanceof Error ? err.message : `Failed to send ${denom}`);
        }
    }, [address, currentNetwork, refreshBalance]);

    return {
        address,
        balance,
        isLoading,
        error,
        refreshBalance,
        importSeedPhrase,
        sendTokens,
    };
};

export default useCosmosWallet;
