import React from "react";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { ETH_CHAIN_ID } from "../../config/constants";
import { createAuthPayload } from "../../utils/cosmos/signing";
import { buildPlayerAvatar } from "../../utils/profile/avatarPayload";
import { Modal } from "../common/Modal";
import styles from "./ProfileAvatarModal.module.css";

const PROFILE_NFT_CHAIN_ID = Number(import.meta.env.VITE_PROFILE_NFT_CHAIN_ID || ETH_CHAIN_ID);
const PROFILE_AVATAR_DEBUG = import.meta.env.DEV && ["1", "true"].includes((import.meta.env.VITE_DEBUG_AVATAR_SYNC || "").toLowerCase());

export const ProfileAvatarModal: React.FC = () => {
    const [debugCopyStatus, setDebugCopyStatus] = React.useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const {
        isDrawerOpen,
        closeDrawer,
        isWalletConnected,
        walletAddress,
        openConnectModal,
        walletNfts,
        isLoadingNfts,
        nftsError,
        nftsWarning,
        selectedAvatar,
        selectAvatar,
        clearAvatar,
        refreshWalletNfts,
        disconnectWallet,
        hasSourceConfigured,
        sourceMode
    } = useProfileAvatar();

    const handleCopyDebugPayload = React.useCallback(async () => {
        if (!selectedAvatar) {
            setDebugCopyStatus("Select an avatar first.");
            return;
        }

        try {
            const authPayload = await createAuthPayload();
            if (!authPayload) {
                setDebugCopyStatus("Missing signing auth payload.");
                return;
            }

            const payload = {
                playerAddress: authPayload.playerAddress,
                timestamp: authPayload.timestamp,
                signature: authPayload.signature,
                avatar: buildPlayerAvatar({
                    chainId: PROFILE_NFT_CHAIN_ID,
                    contractAddress: selectedAvatar.contractAddress,
                    tokenId: selectedAvatar.tokenId,
                    imageUrl: selectedAvatar.imageUrl
                })
            };

            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            setDebugCopyStatus("Debug payload copied.");
        } catch {
            setDebugCopyStatus("Failed to copy debug payload.");
        }
    }, [selectedAvatar]);

    const handleRefresh = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refreshWalletNfts();
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshWalletNfts]);

    React.useEffect(() => {
        if (!debugCopyStatus) {
            return;
        }

        const timer = window.setTimeout(() => {
            setDebugCopyStatus(null);
        }, 2500);

        return () => {
            window.clearTimeout(timer);
        };
    }, [debugCopyStatus]);

    const filteredWalletNfts = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) {
            return walletNfts;
        }

        return walletNfts.filter(asset => {
            const collectionName = (asset.collectionName || "").toLowerCase();
            const assetName = (asset.name || "").toLowerCase();
            const tokenId = asset.tokenId.toLowerCase();
            return collectionName.includes(normalizedSearch) || assetName.includes(normalizedSearch) || tokenId.includes(normalizedSearch);
        });
    }, [walletNfts, searchTerm]);

    if (!isDrawerOpen) {
        return null;
    }

    return (
        <Modal
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            title="Select Profile Avatar"
            titleIcon="🖼"
            widthClass="w-[640px]"
            className={styles.modalSurface}
            patternId="avatar-modal-pattern"
        >
            <div className={styles.content}>
                {!isWalletConnected ? (
                    <>
                        <p className={styles.emptyText}>Connect your Web3 wallet to scan NFTs for profile avatars.</p>
                        <div className={styles.footerActions}>
                            <button className={styles.footerPrimaryButton} onClick={openConnectModal}>Connect Wallet</button>
                            <button className={styles.footerDangerButton} onClick={closeDrawer}>Cancel</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.surfaceMuted}>
                            <p className={styles.meta}>Wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</p>
                            {PROFILE_AVATAR_DEBUG && (
                                <button className={styles.inlineDebugButton} onClick={handleCopyDebugPayload}>Copy Debug Payload</button>
                            )}
                        </div>

                        {PROFILE_AVATAR_DEBUG && debugCopyStatus && <p className={styles.meta}>{debugCopyStatus}</p>}

                        {!hasSourceConfigured && (
                            <p className={styles.emptyText}>
                                {sourceMode === "collections"
                                    ? "No profile NFT contracts configured. Set VITE_PROFILE_NFT_CONTRACTS."
                                    : "No wallet NFT indexer configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_ALCHEMY_URL."}
                            </p>
                        )}

                        {isLoadingNfts && walletNfts.length === 0 && !isRefreshing && <p className={styles.emptyText}>Scanning wallet NFTs...</p>}
                        {nftsError && <p className={styles.emptyText}>{nftsError}</p>}
                        {nftsWarning && <p className={styles.emptyText}>{nftsWarning}</p>}

                        {walletNfts.length > 0 && (
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                                placeholder="Search NFTs by name, collection, or token ID"
                                className={styles.searchInput}
                            />
                        )}

                        {!isLoadingNfts && walletNfts.length === 0 && hasSourceConfigured && !nftsError && (
                            <p className={styles.emptyText}>
                                {sourceMode === "collections"
                                    ? "No NFTs found in configured collections."
                                    : "No NFTs found in this wallet."}
                            </p>
                        )}

                        {!isLoadingNfts && walletNfts.length > 0 && filteredWalletNfts.length === 0 && (
                            <p className={styles.emptyText}>No NFTs match your search.</p>
                        )}

                        <div className={styles.assetGrid}>
                            {filteredWalletNfts.map(asset => {
                                const isSelected =
                                    selectedAvatar?.contractAddress.toLowerCase() === asset.contractAddress.toLowerCase() &&
                                    selectedAvatar?.tokenId === asset.tokenId;

                                return (
                                    <button
                                        key={asset.id}
                                        className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`.trim()}
                                        onClick={() => selectAvatar(asset)}
                                    >
                                        <img src={asset.imageUrl} alt={asset.name || `NFT #${asset.tokenId}`} className={styles.nftImage} />
                                        <p className={styles.meta}>{asset.collectionName || "Collection"} • #{asset.tokenId}</p>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={styles.footerActions}>
                            <button
                                className={styles.footerPrimaryButton}
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? (
                                    <span className={styles.buttonLoadingContent}>
                                        <span className={styles.buttonSpinner} />
                                        Refreshing...
                                    </span>
                                ) : (
                                    "Refresh"
                                )}
                            </button>
                            <button
                                className={styles.footerSecondaryButton}
                                onClick={clearAvatar}
                                disabled={!selectedAvatar}
                            >
                                Clear
                            </button>
                            <button
                                className={styles.footerSecondaryButton}
                                onClick={disconnectWallet}
                            >
                                Disconnect Wallet
                            </button>
                            <button className={styles.footerDangerButton} onClick={closeDrawer}>Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ProfileAvatarModal;
