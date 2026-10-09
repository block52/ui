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
import { assertNftAuthorizationSigner, buildNftAuthorizationMessage, broadcastNftRegistration, queryNftAvatar } from "../../utils/profile/nftRegistration";
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
 *
 * Browsing NFTs (ui#733): the NFT list does not need a connected wallet. It
 * shows the connected wallet's NFTs, else an address the player typed, else
 * the ETH address already linked on chain (from their registration). Only
 * changing the avatar needs the wallet connected, because it must sign.
 *
 * See docs/NFTS.md for the whole system.
 */

interface ProfileAvatarContextType extends ProfileAvatarState {
    isDrawerOpen: boolean;
    isWalletConnected: boolean;
    walletAddress?: string;
    /** The ETH address this Block52 account linked on chain when it registered an avatar, if any. */
    linkedEthAddress: string | null;
    /** The address whose NFTs are listed: the connected wallet, else a typed address, else the linked one. */
    viewAddress: string | null;
    /** Browse another address's NFTs without connecting (null returns to the default). */
    setBrowseAddress: (address: string | null) => void;
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
const AVATAR_CLEARED_KEY = "b52_nft_avatar_cleared";

function isAvatarExplicitlyCleared(cosmosAddr: string): boolean {
    return localStorage.getItem(AVATAR_CLEARED_KEY) === cosmosAddr.toLowerCase();
}

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
    const [linkedEthAddress, setLinkedEthAddress] = useState<string | null>(null);
    const [browseAddress, setBrowseAddress] = useState<string | null>(null);

    // Whose NFTs to list. A connected wallet wins: it's the one that can sign.
    const viewAddress = (isConnected && address) || browseAddress || linkedEthAddress;

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

    const { walletNfts, isLoadingNfts, nftsError, nftsWarning, refreshWalletNfts, hasSourceConfigured } = useWalletNfts(viewAddress ?? undefined, Boolean(viewAddress));

    // On mount / wallet change, fetch the current user's on-chain avatar.
    // Cosmos chain is the source of truth — resolve image directly from the
    // NFT contract so we never depend on the ETH wallet being connected.
    useEffect(() => {
        if (!cosmosAddress) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedAvatar(null);
            setLinkedEthAddress(null);
            return;
        }

        const cleared = isAvatarExplicitlyCleared(cosmosAddress);

        const fetchOwnAvatar = async () => {
            try {
                const { restEndpoint } = getCosmosUrls(currentNetwork);
                const result = await queryNftAvatar(restEndpoint, cosmosAddress);
                // The linked wallet is known even if the avatar was cleared locally.
                setLinkedEthAddress(result?.ethAddress || null);

                // Skip restoring the image if the user explicitly cleared their avatar.
                if (result && !cleared) {
                    // We have contract + tokenId from chain.
                    // Try wallet NFTs first (fast, already loaded), then
                    // resolve directly from the NFT contract via RPC.
                    const matchingNft = walletNfts.find(
                        n => n.contractAddress.toLowerCase() === result.contractAddress.toLowerCase() && n.tokenId === result.tokenId
                    );

                    let imageUrl = matchingNft?.imageUrl || "";

                    if (!imageUrl) {
                        imageUrl = await resolveNftImageUrl(result.contractAddress, result.tokenId) || "";
                    }

                    if (!imageUrl) return;

                    setSelectedAvatar({
                        contractAddress: result.contractAddress,
                        tokenId: result.tokenId,
                        imageUrl,
                        name: matchingNft?.name,
                        selectedAt: Date.now()
                    });

                    setChainAvatarCache(prev => {
                        const next = new Map(prev);
                        next.set(cosmosAddress.toLowerCase(), imageUrl);
                        return next;
                    });
                }
            } catch (err) {
                console.error("[ProfileAvatar] Failed to fetch on-chain avatar:", err);
            }
        };

        fetchOwnAvatar();
    }, [cosmosAddress, currentNetwork, walletNfts]);

    // List the NFTs again whenever the address being viewed changes (a wallet
    // connects, the linked address loads, or the player types one).
    useEffect(() => {
        if (!viewAddress) {
            return;
        }
        refreshWalletNfts();
    }, [viewAddress, refreshWalletNfts]);

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
            // Changing the avatar needs the wallet itself: it must sign.
            if (!isConnected || !address || !cosmosAddress) {
                return;
            }

            setIsRegistering(true);
            setRegistrationError(null);

            const doRegistration = async () => {
                // Step 1: Sign with wagmi (ETH personal_sign)
                const authMessage = buildNftAuthorizationMessage(address, cosmosAddress, asset.contractAddress, asset.tokenId);
                // Ask for THIS account's signature, and check it before paying for
                // a cosmos tx the chain would reject (ui#733).
                const signature = await signMessage(authMessage, address);
                assertNftAuthorizationSigner(authMessage, signature, address);

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
                setLinkedEthAddress(address.toLowerCase());
                localStorage.removeItem(AVATAR_CLEARED_KEY);
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
        [isConnected, address, cosmosAddress, currentNetwork, signMessage]
    );

    const clearAvatar = useCallback(() => {
        setSelectedAvatar(null);
        if (cosmosAddress) {
            setChainAvatarCache(prev => {
                const next = new Map(prev);
                next.delete(cosmosAddress.toLowerCase());
                return next;
            });
            // Mark as explicitly cleared so on-chain queries don't restore it
            localStorage.setItem(AVATAR_CLEARED_KEY, cosmosAddress.toLowerCase());
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
            linkedEthAddress,
            viewAddress,
            setBrowseAddress,
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
            linkedEthAddress,
            viewAddress,
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
