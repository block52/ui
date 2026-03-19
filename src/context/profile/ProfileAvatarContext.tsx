import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useConnection as useWagmiAccount } from "wagmi";
import { ETH_CHAIN_ID } from "../../config/constants";
import { createAuthPayload } from "../../utils/cosmos/signing";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import useCosmosWallet from "../../hooks/wallet/useCosmosWallet";
import { useWalletNfts } from "../../hooks/profile/useWalletNfts";
import type { AvatarSelection, ProfileAvatarState, ProfileNftSourceMode, WalletNftAsset } from "../../types/profile/avatar";
import {
    clearStoredAvatarSelection,
    getStoredAvatarSelection,
    getStoredAvatarSelectionForAddress,
    setStoredAvatarSelection
} from "../../utils/profile/avatarStorage";
import { buildPlayerAvatar, parsePlayerAvatar } from "../../utils/profile/avatarPayload";

const PROFILE_NFT_CHAIN_ID = Number(import.meta.env.VITE_PROFILE_NFT_CHAIN_ID || ETH_CHAIN_ID);
const PROFILE_AVATAR_UPDATE_URL = (import.meta.env.VITE_PROFILE_AVATAR_UPDATE_URL || "").trim();
const PROFILE_AVATAR_DEBUG = import.meta.env.DEV && ["1", "true"].includes((import.meta.env.VITE_DEBUG_AVATAR_SYNC || "").toLowerCase());

interface ProfileAvatarContextType extends ProfileAvatarState {
    isDrawerOpen: boolean;
    isWalletConnected: boolean;
    walletAddress?: string;
    hasContractsConfigured: boolean;
    hasSourceConfigured: boolean;
    sourceMode: ProfileNftSourceMode;
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

export const ProfileAvatarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isConnected, address, open, disconnect } = useUserWalletConnect();
    const { address: cosmosAddress } = useCosmosWallet();
    const { chain } = useWagmiAccount();
    const chainId = chain?.id || ETH_CHAIN_ID;

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState<AvatarSelection | null>(null);

    const { walletNfts, isLoadingNfts, nftsError, nftsWarning, refreshWalletNfts, hasContractsConfigured, hasSourceConfigured, sourceMode } = useWalletNfts(
        address,
        isConnected
    );

    useEffect(() => {
        if (!address && !cosmosAddress) {
            setSelectedAvatar(null);
            return;
        }

        const storedSelection =
            (address ? getStoredAvatarSelection(address, chainId) : null) || (cosmosAddress ? getStoredAvatarSelection(cosmosAddress, chainId) : null);
        setSelectedAvatar(storedSelection);
    }, [address, cosmosAddress, chainId]);

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

    const selectAvatar = useCallback(
        (asset: WalletNftAsset) => {
            const linkedAddresses = [address, cosmosAddress].filter((value): value is string => Boolean(value));
            if (linkedAddresses.length === 0) {
                return;
            }

            const nextSelection: AvatarSelection = {
                contractAddress: asset.contractAddress,
                tokenId: asset.tokenId,
                imageUrl: asset.imageUrl,
                name: asset.name,
                selectedAt: Date.now()
            };

            setSelectedAvatar(nextSelection);
            for (const linkedAddress of linkedAddresses) {
                setStoredAvatarSelection(linkedAddress, nextSelection, chainId);
            }

            if (!PROFILE_AVATAR_UPDATE_URL) {
                return;
            }

            const syncAvatarSelection = async (): Promise<void> => {
                const authPayload = await createAuthPayload();
                if (!authPayload) {
                    return;
                }

                const avatar = buildPlayerAvatar({
                    chainId: PROFILE_NFT_CHAIN_ID,
                    contractAddress: asset.contractAddress,
                    tokenId: asset.tokenId,
                    imageUrl: asset.imageUrl
                });

                const response = await fetch(PROFILE_AVATAR_UPDATE_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        playerAddress: authPayload.playerAddress,
                        timestamp: authPayload.timestamp,
                        signature: authPayload.signature,
                        avatar
                    })
                });

                if (PROFILE_AVATAR_DEBUG) {
                    console.info("[ProfileAvatarDebug] Avatar sync request", {
                        endpoint: PROFILE_AVATAR_UPDATE_URL,
                        playerAddress: authPayload.playerAddress,
                        timestamp: authPayload.timestamp,
                        signaturePresent: Boolean(authPayload.signature),
                        avatar
                    });
                    console.info("[ProfileAvatarDebug] Avatar sync response", {
                        status: response.status,
                        ok: response.ok
                    });
                }

                if (!response.ok) {
                    throw new Error(`Avatar sync failed with status ${response.status}`);
                }
            };

            void syncAvatarSelection().catch((error: unknown) => {
                console.error("[ProfileAvatar] Failed to sync avatar selection:", error);
            });
        },
        [address, cosmosAddress, chainId]
    );

    const clearAvatar = useCallback(() => {
        const linkedAddresses = [address, cosmosAddress].filter((value): value is string => Boolean(value));
        if (linkedAddresses.length === 0) {
            return;
        }

        setSelectedAvatar(null);
        for (const linkedAddress of linkedAddresses) {
            clearStoredAvatarSelection(linkedAddress, chainId);
        }
    }, [address, cosmosAddress, chainId]);

    const getAvatarForAddress = useCallback(
        (targetAddress?: string, playerAvatar?: string): string | null => {
            const parsedAvatar = parsePlayerAvatar(playerAvatar);
            if (parsedAvatar?.avatarUrl) {
                return parsedAvatar.avatarUrl;
            }

            if (!targetAddress) {
                return null;
            }

            if (
                (address && targetAddress.toLowerCase() === address.toLowerCase()) ||
                (cosmosAddress && targetAddress.toLowerCase() === cosmosAddress.toLowerCase())
            ) {
                return selectedAvatar?.imageUrl ?? null;
            }

            const storedSelection = getStoredAvatarSelectionForAddress(targetAddress);
            return storedSelection?.imageUrl ?? null;
        },
        [address, cosmosAddress, selectedAvatar]
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
            hasContractsConfigured,
            hasSourceConfigured,
            sourceMode,
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
            hasContractsConfigured,
            hasSourceConfigured,
            sourceMode,
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
