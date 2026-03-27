import React from "react";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { Modal } from "../common/Modal";
import styles from "./ProfileAvatarModal.module.css";

export const ProfileAvatarModal: React.FC = () => {
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
        hasSourceConfigured
    } = useProfileAvatar();

    const handleRefresh = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refreshWalletNfts();
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshWalletNfts]);

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
                        </div>

                        {!hasSourceConfigured && (
                            <p className={styles.emptyText}>
                                No wallet NFT indexer configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_MAINNET_RPC_URL.
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
                            <p className={styles.emptyText}>No NFTs found in this wallet.</p>
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
