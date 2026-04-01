import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useConnection } from "wagmi";
import { ETH_CHAIN_ID } from "../../config/constants";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import useCosmosWallet from "../../hooks/wallet/useCosmosWallet";
import useSignMessage from "../../hooks/wallet/useSignMessage";
import { useNetwork } from "../NetworkContext";
import { useWalletNfts } from "../../hooks/profile/useWalletNfts";
import type { AvatarSelection, AvatarSelectionStorageV1, ProfileAvatarState, WalletNftAsset } from "../../types/profile/avatar";
import { parsePlayerAvatar } from "../../utils/profile/avatarPayload";
import { buildNftAuthorizationMessage, broadcastNftRegistration, queryNftAvatar } from "../../utils/profile/nftRegistration";
import { resolveNftImageUrl } from "../../utils/profile/nftImageResolver";
import { getCosmosUrls } from "../../utils/cosmos/urls";

/**
 * ProfileAvatarContext
 *
 * NFT Avatar registration and retrieval via the cosmos chain.
 *
 * Registration flow:
 *   1. User selects NFT from their ETH wallet (useWalletNfts / modal)
 *   2. User signs authorization with MetaMask:
 *      "I, <ethAddress>, authorize <cosmosAddress> to use NFT <contract>:<tokenId>"
 *   3. Signed message is broadcast to the cosmos validator (cosmos tx)
 *   4. Validator verifies ETH signature via ecrecover, stores on-chain:
 *      cosmos address → (NFT contract address, token ID)
 *
 * Retrieval:
 *   - FE calls the node REST API with a cosmos address to get the NFT metadata.
 *   - Results are cached for the session to avoid redundant requests.
 */

interface ProfileAvatarContextType extends ProfileAvatarState {
    isDrawerOpen: boolean;
    isWalletConnected: boolean;
    walletAddress?: string;
    hasSourceConfigured: boolean;
    isRegistering: boolean;
    registrationError: string | null;
    openConnectModal: () => void;
    disconnectWallet: () => void;
    openDrawer: () => void;
    closeDrawer: () => void;
    refreshWalletNfts: () => Promise<void>;
    selectAvatar: (asset: WalletNftAsset) => void;
    clearAvatar: () => void;
    getAvatarForAddress: (address?: string, playerAvatar?: string) => string | null;
}

const ProfileAvatarContext = createContext<ProfileAvatarContextType | null>(null);

const AVATAR_CACHE_KEY = "b52_nft_avatar";

function loadCachedAvatar(cosmosAddr: string): AvatarSelection | null {
    try {
        const raw = localStorage.getItem(AVATAR_CACHE_KEY);
        if (!raw) return null;
        const stored: AvatarSelectionStorageV1 = JSON.parse(raw);
        if (stored.version !== 1 || stored.walletAddress.toLowerCase() !== cosmosAddr.toLowerCase()) return null;
        return stored.selection;
    } catch {
        return null;
    }
}

function saveCachedAvatar(cosmosAddr: string, selection: AvatarSelection | null) {
    if (!selection) {
        localStorage.removeItem(AVATAR_CACHE_KEY);
        return;
    }
    const stored: AvatarSelectionStorageV1 = {
        version: 1,
        chainId: 1,
        walletAddress: cosmosAddr,
        selection
    };
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(stored));
}

export const ProfileAvatarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isConnected, address, open, disconnect } = useUserWalletConnect();
    const { address: cosmosAddress } = useCosmosWallet();
    const { currentNetwork } = useNetwork();
    const { chain } = useConnection();
    const { signMessage } = useSignMessage();
    const _chainId = chain?.id || ETH_CHAIN_ID;

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState<AvatarSelection | null>(() => (cosmosAddress ? loadCachedAvatar(cosmosAddress) : null));
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationError, setRegistrationError] = useState<string | null>(null);

    // Session cache for chain-queried avatars: cosmosAddress → imageUrl
    const [chainAvatarCache, setChainAvatarCache] = useState<Map<string, string | null>>(new Map());

    // Persist avatar selection to localStorage
    useEffect(() => {
        if (cosmosAddress) {
            saveCachedAvatar(cosmosAddress, selectedAvatar);
        }
    }, [selectedAvatar, cosmosAddress]);

    // Track in-flight chain queries to avoid duplicate requests
    const pendingQueriesRef = useRef(new Set<string>());

    const { walletNfts, isLoadingNfts, nftsError, nftsWarning, refreshWalletNfts, hasSourceConfigured } = useWalletNfts(address, isConnected);

    // On mount / wallet change, fetch the current user's on-chain avatar
    useEffect(() => {
        if (!cosmosAddress) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedAvatar(null);
            return;
        }

        const fetchOwnAvatar = async () => {
            try {
                const { restEndpoint } = getCosmosUrls(currentNetwork);
                const result = await queryNftAvatar(restEndpoint, cosmosAddress);

                if (result) {
                    // We have contract + tokenId from chain.
                    // The image URL needs to be resolved — check if we already have it
                    // from the wallet NFT list, otherwise store without image for now.
                    const matchingNft = walletNfts.find(
                        n => n.contractAddress.toLowerCase() === result.contractAddress.toLowerCase() && n.tokenId === result.tokenId
                    );

                    setSelectedAvatar({
                        contractAddress: result.contractAddress,
                        tokenId: result.tokenId,
                        imageUrl: matchingNft?.imageUrl || "",
                        name: matchingNft?.name,
                        selectedAt: Date.now()
                    });

                    if (matchingNft?.imageUrl) {
                        setChainAvatarCache(prev => {
                            const next = new Map(prev);
                            next.set(cosmosAddress.toLowerCase(), matchingNft.imageUrl);
                            return next;
                        });
                    }
                }
            } catch (err) {
                console.error("[ProfileAvatar] Failed to fetch on-chain avatar:", err);
            }
        };

        fetchOwnAvatar();
    }, [cosmosAddress, currentNetwork, walletNfts]);

    // Refresh wallet NFTs when ETH wallet connects
    useEffect(() => {
        if (!isConnected || !address) {
            return;
        }
        refreshWalletNfts();
    }, [isConnected, address, refreshWalletNfts]);

    const openDrawer = useCallback(() => {
        setIsDrawerOpen(true);
    }, []);

    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    /**
     * Select an NFT avatar: signs with wallet then broadcasts to cosmos.
     *
     * Flow:
     *   1. Wallet personal_sign — "I, <ethAddr>, authorize <cosmosAddr> to use NFT ..."
     *   2. Cosmos tx broadcast — includes ETH signature for validator verification
     *   3. Validator stores: cosmosAddress → (contractAddress, tokenId)
     */
    const selectAvatar = useCallback(
        (asset: WalletNftAsset) => {
            if (!address || !cosmosAddress) {
                return;
            }

            setIsRegistering(true);
            setRegistrationError(null);

            const doRegistration = async () => {
                // Step 1: Sign with wagmi (ETH personal_sign)
                const authMessage = buildNftAuthorizationMessage(address, cosmosAddress, asset.contractAddress, asset.tokenId);
                const signature = await signMessage(authMessage);

                // Step 2: Broadcast to cosmos validator
                await broadcastNftRegistration(currentNetwork, address, cosmosAddress, asset.contractAddress, asset.tokenId, signature);

                // Success — update local state
                const nextSelection: AvatarSelection = {
                    contractAddress: asset.contractAddress,
                    tokenId: asset.tokenId,
                    imageUrl: asset.imageUrl,
                    name: asset.name,
                    selectedAt: Date.now()
                };

                setSelectedAvatar(nextSelection);
                setChainAvatarCache(prev => {
                    const next = new Map(prev);
                    next.set(cosmosAddress.toLowerCase(), asset.imageUrl);
                    return next;
                });
            };

            doRegistration()
                .catch((err: unknown) => {
                    const errMessage = err instanceof Error ? err.message : "Failed to register NFT avatar";
                    console.error("[ProfileAvatar] Registration failed:", err);
                    setRegistrationError(errMessage);
                })
                .finally(() => {
                    setIsRegistering(false);
                });
        },
        [address, cosmosAddress, currentNetwork, signMessage]
    );

    const clearAvatar = useCallback(() => {
        setSelectedAvatar(null);
        if (cosmosAddress) {
            setChainAvatarCache(prev => {
                const next = new Map(prev);
                next.delete(cosmosAddress.toLowerCase());
                return next;
            });
        }
        // TODO: Send a cosmos tx to clear the on-chain avatar when SDK supports it
    }, [cosmosAddress]);

    /**
     * Get avatar image URL for any player address.
     *
     * Priority:
     *   1. Parse playerAvatar string from game state (if server includes it)
     *   2. Current user's selected avatar (from registration)
     *   3. Chain avatar cache (from prior REST queries)
     *   4. Trigger async chain query for unknown addresses (result appears on next render)
     */
    // On mount, query chain for current user's registered avatar and resolve image
    const hasQueriedSelf = useRef(false);
    useEffect(() => {
        if (!cosmosAddress || hasQueriedSelf.current || selectedAvatar) return;
        hasQueriedSelf.current = true;

        const { restEndpoint } = getCosmosUrls(currentNetwork);
        queryNftAvatar(restEndpoint, cosmosAddress).then(async result => {
            if (!result) return;

            // Resolve image directly from the NFT contract — no wallet needed
            const imageUrl = await resolveNftImageUrl(result.contractAddress, result.tokenId);
            if (imageUrl) {
                setSelectedAvatar({
                    contractAddress: result.contractAddress,
                    tokenId: result.tokenId,
                    imageUrl,
                    selectedAt: Date.now()
                });
                setChainAvatarCache(prev => {
                    const next = new Map(prev);
                    next.set(cosmosAddress.toLowerCase(), imageUrl);
                    return next;
                });
            }
        });
    }, [cosmosAddress, currentNetwork, selectedAvatar]);

    const getAvatarForAddress = useCallback(
        (targetAddress?: string, playerAvatar?: string): string | null => {
            // 1. Try parsing the avatar string from game state
            const parsedAvatar = parsePlayerAvatar(playerAvatar);
            if (parsedAvatar?.avatarUrl) {
                return parsedAvatar.avatarUrl;
            }

            if (!targetAddress) {
                return null;
            }

            const normalized = targetAddress.toLowerCase();

            // 2. Current user's avatar
            if (cosmosAddress && normalized === cosmosAddress.toLowerCase()) {
                return selectedAvatar?.imageUrl || null;
            }

            // 3. Chain avatar cache
            if (chainAvatarCache.has(normalized)) {
                return chainAvatarCache.get(normalized) || null;
            }

            // 4. Trigger async chain query (fires once per address per session)
            if (!pendingQueriesRef.current.has(normalized)) {
                pendingQueriesRef.current.add(normalized);

                const { restEndpoint } = getCosmosUrls(currentNetwork);
                queryNftAvatar(restEndpoint, targetAddress).then(async result => {
                    const imageUrl = result ? await resolveNftImageUrl(result.contractAddress, result.tokenId) : null;
                    setChainAvatarCache(prev => {
                        const next = new Map(prev);
                        next.set(normalized, imageUrl);
                        return next;
                    });
                });
            }

            return null;
        },
        [cosmosAddress, selectedAvatar, currentNetwork, chainAvatarCache]
    );

    const contextValue = useMemo(
        (): ProfileAvatarContextType => ({
            selectedAvatar,
            walletNfts,
            isLoadingNfts,
            nftsError,
            nftsWarning,
            isDrawerOpen,
            isWalletConnected: !!isConnected,
            walletAddress: address,
            hasSourceConfigured,
            isRegistering,
            registrationError,
            openConnectModal: open,
            disconnectWallet: disconnect,
            openDrawer,
            closeDrawer,
            refreshWalletNfts,
            selectAvatar,
            clearAvatar,
            getAvatarForAddress
        }),
        [
            selectedAvatar,
            walletNfts,
            isLoadingNfts,
            nftsError,
            nftsWarning,
            isDrawerOpen,
            isConnected,
            address,
            hasSourceConfigured,
            isRegistering,
            registrationError,
            open,
            disconnect,
            openDrawer,
            closeDrawer,
            refreshWalletNfts,
            selectAvatar,
            clearAvatar,
            getAvatarForAddress
        ]
    );

    return <ProfileAvatarContext.Provider value={contextValue}>{children}</ProfileAvatarContext.Provider>;
};

export const useProfileAvatar = (): ProfileAvatarContextType => {
    const context = useContext(ProfileAvatarContext);
    if (!context) {
        throw new Error("useProfileAvatar must be used within ProfileAvatarProvider");
    }

    return context;
};
