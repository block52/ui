import React from "react";
import { toast } from "react-toastify";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { Modal } from "../common/Modal";
import styles from "./ProfileAvatarModal.module.css";
import { isEmpty, hasElements } from "../../utils/guards";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { isEthAddress } from "../../utils/profile/nftRegistration";

const CopyButton: React.FC<{ copied: boolean; onClick: () => void }> = ({ copied, onClick }) => (
    <button type="button" onClick={onClick} className={styles.copyButton} title="Copy address">
        {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
        ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
            </svg>
        )}
    </button>
);

/**
 * The avatar picker (ui#733). NFTs are listed without a connected wallet: the
 * connected wallet's, else a typed address's, else the wallet already linked
 * on chain. Picking one as the avatar needs the wallet connected to sign.
 */
export const ProfileAvatarModal: React.FC = () => {
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [justRegistered, setJustRegistered] = React.useState(false);
    const [registeringAssetId, setRegisteringAssetId] = React.useState<string | null>(null);
    const [addressDraft, setAddressDraft] = React.useState("");
    const [addressDraftError, setAddressDraftError] = React.useState<string | null>(null);
    const prevIsRegistering = React.useRef(false);
    const {
        isDrawerOpen,
        closeDrawer,
        isWalletConnected,
        walletAddress,
        linkedEthAddress,
        viewAddress,
        setBrowseAddress,
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

    const { copy, copied } = useCopyToClipboard();

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

    // The address box starts on whatever is being viewed (linked or typed).
    React.useEffect(() => {
        if (isDrawerOpen) {
            setAddressDraft(viewAddress ?? "");
            setAddressDraftError(null);
        }
    }, [isDrawerOpen, viewAddress]);

    const handleViewAddress = React.useCallback(
        (event: React.FormEvent) => {
            event.preventDefault();
            const next = addressDraft.trim();
            if (!next) {
                setAddressDraftError(null);
                setBrowseAddress(null);
                return;
            }
            if (!isEthAddress(next)) {
                setAddressDraftError("Enter an Ethereum address (0x followed by 40 hex characters).");
                return;
            }
            setAddressDraftError(null);
            setBrowseAddress(next);
        },
        [addressDraft, setBrowseAddress]
    );

    const handleRefresh = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refreshWalletNfts();
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshWalletNfts]);

    const handleCopyAddress = React.useCallback(() => {
        if (viewAddress) {
            copy(viewAddress, "Address copied!");
        }
    }, [copy, viewAddress]);

    const viewingNote = !isWalletConnected
        ? viewAddress
            ? `${linkedEthAddress && viewAddress.toLowerCase() === linkedEthAddress.toLowerCase() ? "Showing the NFTs of the wallet linked to your Block52 account." : "Showing the NFTs of this address."} Connect that wallet to change your avatar.`
            : "Enter an Ethereum address to see its NFTs, or connect your wallet to pick an avatar."
        : null;

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
                <div className={styles.walletAddressRow}>
                    <label className={styles.walletLabel} htmlFor="avatar-wallet-address">
                        {isWalletConnected ? "Connected wallet" : "Wallet"}
                    </label>
                    {isWalletConnected ? (
                        <div className={styles.walletInputWrapper}>
                            <input id="avatar-wallet-address" type="text" value={walletAddress || ""} readOnly className={styles.walletInput} />
                            <CopyButton copied={copied} onClick={handleCopyAddress} />
                        </div>
                    ) : (
                        <form className={styles.walletInputWrapper} onSubmit={handleViewAddress}>
                            <input
                                id="avatar-wallet-address"
                                type="text"
                                value={addressDraft}
                                onChange={event => setAddressDraft(event.target.value)}
                                placeholder="0x… Ethereum address"
                                spellCheck={false}
                                autoComplete="off"
                                className={styles.walletInput}
                            />
                            <button type="submit" className={styles.copyButton}>
                                View
                            </button>
                        </form>
                    )}
                    {addressDraftError && <p className={styles.fieldError}>{addressDraftError}</p>}
                </div>

                {viewingNote && (
                    <div className={styles.surfaceMuted}>
                        <p className={styles.noteText}>{viewingNote}</p>
                        <button className={styles.inlineButton} onClick={openConnectModal}>
                            Connect Wallet
                        </button>
                    </div>
                )}

                {viewAddress && !hasSourceConfigured && (
                    <p className={styles.emptyText}>No wallet NFT indexer configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_MAINNET_RPC_URL.</p>
                )}

                {viewAddress && isLoadingNfts && isEmpty(walletNfts) && !isRefreshing && <p className={styles.emptyText}>Scanning wallet NFTs...</p>}
                {registrationError && <p className={styles.emptyText}>Registration failed: {registrationError}</p>}
                {viewAddress && nftsError && <p className={styles.emptyText}>{nftsError}</p>}
                {viewAddress && nftsWarning && <p className={styles.emptyText}>{nftsWarning}</p>}

                {viewAddress && hasElements(walletNfts) && (
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Search NFTs by name, collection, or token ID"
                        className={styles.searchInput}
                    />
                )}

                {viewAddress && !isLoadingNfts && isEmpty(walletNfts) && hasSourceConfigured && !nftsError && (
                    <p className={styles.emptyText}>No NFTs found in this wallet.</p>
                )}

                {!isLoadingNfts && hasElements(walletNfts) && isEmpty(filteredWalletNfts) && <p className={styles.emptyText}>No NFTs match your search.</p>}

                {viewAddress && hasElements(filteredWalletNfts) && (
                    <div className={styles.assetGrid}>
                        {filteredWalletNfts.map(asset => {
                            const isSelected =
                                selectedAvatar?.contractAddress.toLowerCase() === asset.contractAddress.toLowerCase() &&
                                selectedAvatar?.tokenId === asset.tokenId;

                            return (
                                <button
                                    key={asset.id}
                                    className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`.trim()}
                                    // Picking an avatar signs with the wallet; without one, connect first.
                                    onClick={() => {
                                        if (!isWalletConnected) {
                                            openConnectModal();
                                            return;
                                        }
                                        setRegisteringAssetId(asset.id);
                                        selectAvatar(asset);
                                    }}
                                    title={isWalletConnected ? "Use as my avatar" : "Connect this wallet to use it as your avatar"}
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
                                    <p className={styles.meta}>
                                        {asset.collectionName || "Collection"} • #{asset.tokenId}
                                        {isSelected && " · current"}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className={styles.footerActions}>
                    <button className={styles.footerPrimaryButton} onClick={handleRefresh} disabled={isRefreshing || !viewAddress}>
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
                        className={selectedAvatar ? styles.footerDangerButton : styles.footerSecondaryButton}
                        onClick={() => {
                            clearAvatar();
                            toast.success("Avatar cleared");
                        }}
                        disabled={!selectedAvatar}
                    >
                        Clear Avatar
                    </button>
                    {/* Without a wallet, "Connect Wallet" sits next to the note above. */}
                    {isWalletConnected && (
                        <button className={styles.footerSecondaryButton} onClick={disconnectWallet}>
                            Disconnect Wallet
                        </button>
                    )}
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
                        ) : justRegistered ? (
                            "Done. Now Run It Up!"
                        ) : (
                            "Cancel"
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ProfileAvatarModal;
