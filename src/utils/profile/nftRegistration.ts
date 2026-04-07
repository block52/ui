/**
 * NFT Registration Utilities
 *
 * Handles the 2-step NFT avatar registration flow:
 *   1. User signs an authorization message with their ETH wallet (MetaMask)
 *      proving they own the NFT and granting access to their cosmos address.
 *   2. The signed message is broadcast to the cosmos validator which verifies
 *      the ETH signature and stores the mapping on-chain:
 *      cosmos address → (NFT contract address, token ID)
 */

import { ethers } from "ethers";
import type { NetworkEndpoints } from "../cosmos/urls";
import { getSigningClient } from "../cosmos/client";

/**
 * Build the authorization message that the ETH wallet owner signs.
 *
 * Format: "I, <ethAddress>, authorize <cosmosAddress> to use NFT <contractAddress>:<tokenId>"
 *
 * The validator uses ecrecover on this message + signature to verify
 * the ETH address truly authorized the cosmos address.
 */
export const buildNftAuthorizationMessage = (
    ethAddress: string,
    cosmosAddress: string,
    contractAddress: string,
    tokenId: string
): string => {
    return `I, ${ethAddress.toLowerCase()}, authorize ${cosmosAddress} to use NFT ${contractAddress.toLowerCase()}:${tokenId}`;
};

/**
 * Sign the NFT authorization message using MetaMask (EIP-191 personal_sign).
 *
 * @returns Hex-encoded signature with 0x prefix
 * @throws If MetaMask is not available or user rejects the signature
 */
export const signNftAuthorization = async (
    ethAddress: string,
    cosmosAddress: string,
    contractAddress: string,
    tokenId: string
): Promise<{ message: string; signature: string }> => {
    if (!(window as any).ethereum) {
        throw new Error("MetaMask is not available");
    }

    const message = buildNftAuthorizationMessage(ethAddress, cosmosAddress, contractAddress, tokenId);

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner(ethAddress);
    const signature = await signer.signMessage(message);

    return { message, signature };
};

/**
 * Broadcast the signed NFT registration to the cosmos validator.
 *
 * This sends a cosmos transaction containing:
 * - The ETH signature proving NFT ownership
 * - The NFT contract address and token ID
 * - The cosmos address to associate with the NFT
 *
 * The validator verifies the ETH signature via ecrecover and, if valid,
 * stores the mapping on-chain: cosmosAddress → (contractAddress, tokenId)
 *
 * @returns Transaction hash
 */
export const broadcastNftRegistration = async (
    network: NetworkEndpoints,
    ethAddress: string,
    cosmosAddress: string,
    contractAddress: string,
    tokenId: string,
    ethSignature: string
): Promise<string> => {
    const { signingClient } = await getSigningClient(network);

    // The signing client signs this cosmos tx with the cosmos key,
    // and includes the ETH signature + NFT details in the message payload.
    // The validator verifies both:
    //   1. Cosmos signature (proves cosmos address owner sent this)
    //   2. ETH signature (proves ETH address owner authorized this)
    const registerFn = (signingClient as any).registerNftAvatar;
    if (typeof registerFn !== "function") {
        throw new Error(
            "SDK does not yet support registerNftAvatar(). " +
            "This method needs to be added to SigningCosmosClient in @block52/poker-vm-sdk " +
            "to broadcast MsgRegisterNftAvatar to the chain."
        );
    }

    const txHash: string = await registerFn.call(
        signingClient,
        ethAddress,
        contractAddress,
        tokenId,
        ethSignature
    );

    return txHash;
};

export interface OnChainNftAvatar {
    cosmosAddress: string;
    contractAddress: string;
    tokenId: string;
}

/**
 * Query the cosmos chain REST API for a registered NFT avatar.
 *
 * @param restEndpoint - The cosmos node REST endpoint
 * @param cosmosAddress - The cosmos address to look up
 * @returns The NFT avatar data if registered, or null
 */
export const queryNftAvatar = async (
    restEndpoint: string,
    cosmosAddress: string
): Promise<OnChainNftAvatar | null> => {
    try {
        const response = await fetch(
            `${restEndpoint}/pokerchain/poker/nft_avatar/${cosmosAddress}`
        );

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Failed to query NFT avatar: ${response.status}`);
        }

        const data = await response.json();

        if (!data.contract_address || !data.token_id) {
            return null;
        }

        return {
            cosmosAddress,
            contractAddress: data.contract_address,
            tokenId: data.token_id
        };
    } catch (err) {
        console.error("[nftRegistration] Failed to query NFT avatar:", err);
        return null;
    }
};
