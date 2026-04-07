import React from "react";
import { toast } from "react-toastify";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { Modal } from "../common/Modal";
import styles from "./ProfileAvatarModal.module.css";

export const ProfileAvatarModal: React.FC = () => {
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [addressCopied, setAddressCopied] = React.useState(false);
    const [justRegistered, setJustRegistered] = React.useState(false);
    const [registeringAssetId, setRegisteringAssetId] = React.useState<string | null>(null);
    const prevIsRegistering = React.useRef(false);
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
        isRegistering,
        registrationError
    } = useProfileAvatar();

    // Detect registration completion
    React.useEffect(() => {
        if (prevIsRegistering.current && !isRegistering) {
            setRegisteringAssetId(null);
            if (!registrationError) {
                setJustRegistered(true);
            }
        }
        prevIsRegistering.current = isRegistering;
    }, [isRegistering, registrationError]);

    // Reset success state when drawer closes
    React.useEffect(() => {
        if (!isDrawerOpen) {
            setJustRegistered(false);
        }
    }, [isDrawerOpen]);

    const handleRefresh = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refreshWalletNfts();
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshWalletNfts]);

    const handleCopyAddress = React.useCallback(() => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setAddressCopied(true);
            toast.success("Address copied!");
            setTimeout(() => setAddressCopied(false), 2000);
        }
    }, [walletAddress]);

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
                        <div className={styles.walletAddressRow}>
                            <label className={styles.walletLabel}>Wallet</label>
                            <div className={styles.walletInputWrapper}>
                                <input
                                    type="text"
                                    value={walletAddress || ""}
                                    readOnly
                                    className={styles.walletInput}
                                />
                                <button
                                    onClick={handleCopyAddress}
                                    className={styles.copyButton}
                                    title="Copy address"
                                >
                                    {addressCopied ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {!hasSourceConfigured && (
                            <p className={styles.emptyText}>
                                No wallet NFT indexer configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_MAINNET_RPC_URL.
                            </p>
                        )}

                        {isLoadingNfts && walletNfts.length === 0 && !isRefreshing && <p className={styles.emptyText}>Scanning wallet NFTs...</p>}
                        {registrationError && <p className={styles.emptyText}>Registration failed: {registrationError}</p>}
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
                                        onClick={() => { setRegisteringAssetId(asset.id); selectAvatar(asset); }}
                                        disabled={isRegistering}
                                    >
                                        <div className={styles.nftImageWrapper}>
                                            <img src={asset.imageUrl} alt={asset.name || `NFT #${asset.tokenId}`} className={styles.nftImage} />
                                            {registeringAssetId === asset.id && isRegistering && (
                                                <div className={styles.nftImageOverlay}>
                                                    <span className={styles.nftSpinner} />
                                                </div>
                                            )}
                                        </div>
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
                            <button
                                className={isRegistering ? styles.footerSecondaryButton : justRegistered ? styles.footerSuccessButton : styles.footerDangerButton}
                                onClick={closeDrawer}
                                disabled={isRegistering}
                            >
                                {isRegistering ? (
                                    <span className={styles.buttonLoadingContent}>
                                        <span className={styles.buttonSpinner} />
                                        Registering...
                                    </span>
                                ) : justRegistered ? "Done. Now Run It Up!" : "Cancel"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ProfileAvatarModal;
