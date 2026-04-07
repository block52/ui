/**
 * useNftRegistration - Hook for the NFT avatar registration flow
 *
 * Handles the 2-step process:
 *   1. Sign authorization message with wagmi (ETH personal_sign)
 *   2. Broadcast signed registration to the cosmos validator
 *
 * The validator verifies the ETH signature and stores on-chain:
 *   cosmos address (key) → NFT contract address + token ID (value)
 */

import { useState, useCallback } from "react";
import { useNetwork } from "../../context/NetworkContext";
import useCosmosWallet from "../wallet/useCosmosWallet";
import useUserWalletConnect from "../wallet/useUserWalletConnect";
import useSignMessage from "../wallet/useSignMessage";
import {
    buildNftAuthorizationMessage,
    broadcastNftRegistration,
} from "../../utils/profile/nftRegistration";
import type { WalletNftAsset } from "../../types/profile/avatar";

interface UseNftRegistrationReturn {
    registerNft: (asset: WalletNftAsset) => Promise<string>;
    isRegistering: boolean;
    registrationError: string | null;
}

export const useNftRegistration = (): UseNftRegistrationReturn => {
    const { currentNetwork } = useNetwork();
    const { address: cosmosAddress } = useCosmosWallet();
    const { address: ethAddress, isConnected: isEthConnected } = useUserWalletConnect();
    const { signMessage } = useSignMessage();

    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationError, setRegistrationError] = useState<string | null>(null);

    const registerNft = useCallback(
        async (asset: WalletNftAsset): Promise<string> => {
            if (!isEthConnected || !ethAddress) {
                throw new Error("Ethereum wallet is not connected");
            }

            if (!cosmosAddress) {
                throw new Error("Block52 wallet is not connected");
            }

            setIsRegistering(true);
            setRegistrationError(null);

            try {
                // Step 1: Sign with wagmi — proves ETH address owner
                // authorizes the cosmos address to use this NFT
                const message = buildNftAuthorizationMessage(
                    ethAddress,
                    cosmosAddress,
                    asset.contractAddress,
                    asset.tokenId
                );
                const signature = await signMessage(message);

                // Step 2: Broadcast to cosmos validator — signed by cosmos key,
                // includes the ETH signature for the validator to verify via ecrecover
                const txHash = await broadcastNftRegistration(
                    currentNetwork,
                    ethAddress,
                    cosmosAddress,
                    asset.contractAddress,
                    asset.tokenId,
                    signature
                );

                return txHash;
            } catch (err: any) {
                const message = err.message || "Failed to register NFT avatar";
                console.error("[useNftRegistration] Registration failed:", err);
                setRegistrationError(message);
                throw err;
            } finally {
                setIsRegistering(false);
            }
        },
        [currentNetwork, cosmosAddress, ethAddress, isEthConnected, signMessage]
    );

    return { registerNft, isRegistering, registrationError };
};

export default useNftRegistration;
