import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation

import "./Dashboard.css"; // Import the CSS file with animations
import styles from "./Dashboard.module.css";

// Ethereum Mainnet imports (for auto-switch to correct chain)
import { ETH_CHAIN_ID } from "../config/constants";
import { useConnection as useWagmiAccount, useSwitchChain } from "wagmi";

import { calculateBuyIn } from "../utils/buyInUtils";
import { BLIND_LEVELS, DEFAULT_BLIND_LEVEL_INDEX, SNG_BLINDS } from "../constants/blindLevels";
import { usdcToMicroBigInt, formatMicroAsUsdc, microToUsdc } from "../constants/currency";

import { WithdrawalModal, USDCDepositModal, UpcomingSngModal } from "../components/modals";
import SendModal from "../components/modals/SendModal";
import { Modal, PoweredBy } from "../components/common";
import { PillButton } from "../components/ui";
import { fieldLabelClass, fieldInputClass, inlinePillClass, insetBoxClass, noticeClass } from "../components/modals/walletFormClasses";
import { CopyIcon, CheckIcon, WarningIcon } from "../components/modals/walletIcons";
import TableList from "../components/TableList";
import WalletPanel from "../components/WalletPanel";
import TransactionPanel from "../components/TransactionPanel";

// Game wallet and SDK imports
// ...existing code...
import { GameFormat, generateWallet as generateWalletSDK, computeGameNameFee } from "@block52/poker-vm-sdk";
import { validateTableName, tableNameCharCount, normalizeTableName } from "../utils/tableName";

// Hook imports from barrel file
import { useUserWalletConnect, useNewTable, useCosmosWallet } from "../hooks";
import type { CreateTableOptions } from "../hooks/game/useNewTable"; // Import type separately

// Cosmos wallet utils
import { isValidSeedPhrase } from "../utils/cosmos";
import { isTournamentFormat, toGameFormat } from "../utils/gameFormatUtils";
import { computeTableCreationFeeMicro, CREATION_FEE_BIG_BLINDS } from "../utils/tableCreationFee";

// Password protection utils
import {
    checkAuthCookie,
    isPasswordProtectionEnabled,
    handlePasswordSubmit as utilHandlePasswordSubmit,
    handlePasswordKeyPress as utilHandlePasswordKeyPress
} from "../utils/passwordProtectionUtils";

// Club branding imports
import { colors, hexToRgba } from "../utils/colorConfig";

// Bech32 address regex: "b52" prefix + "1" separator + valid bech32 data characters
const B52_ADDRESS_REGEX = /^b521[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;

const labelClass = "block text-xs uppercase tracking-[0.08em] text-ink-muted mb-1.5";
const inputClass =
    "w-full h-11 rounded-xl bg-surface-raised border border-line-strong text-ink px-3.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30";
const errorBoxClass = "p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm";

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    // Removed: Game selection state variables - now handled in Create Game modal
    // Removed: Ethereum wallet state - now using Cosmos wallet only

    // Password protection states - skip if no password configured in env
    const passwordEnabled = isPasswordProtectionEnabled();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!passwordEnabled);
    const [passwordInput, setPasswordInput] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const { isConnected, open, address } = useUserWalletConnect();

    // Wagmi hooks for Ethereum Mainnet (USDC deposit bridge)
    const { chain } = useWagmiAccount();
    const switchChain = useSwitchChain();

    // Removed: Ethereum account hook - now using Cosmos wallet only

    // Use the new useNewTable hook from hooks directory
    const { createTable, isCreating: isCreatingTable, error: createTableError } = useNewTable();

    // Removed: Ethereum private key import modal states

    // New game creation states
    const [showCreateGameModal, setShowCreateGameModal] = useState(false);
    const [selectedContractAddress, setSelectedContractAddress] = useState("0x4c1d6ea77a2ba47dcd0771b7cde0df30a6df1bfaa7");
    const [createGameError, setCreateGameError] = useState("");

    // Modal game options
    const [modalGameFormat, setModalGameFormat] = useState<GameFormat>(GameFormat.SIT_AND_GO);
    const [modalTableName, setModalTableName] = useState(""); // Optional paid table name (poker-vm#337)
    const [modalSitAndGoBuyIn, setModalSitAndGoBuyIn] = useState(1); // Single buy-in for Sit & Go
    const [modalPlayerCount, setModalPlayerCount] = useState(4);
    // For Cash Game: min/max players
    const [modalMinPlayers, setModalMinPlayers] = useState(2);
    const [modalMaxPlayers, setModalMaxPlayers] = useState(9);
    // Selected blind level (index in BLIND_LEVELS array)
    const [selectedBlindLevel, setSelectedBlindLevel] = useState(DEFAULT_BLIND_LEVEL_INDEX);
    // Buy-in fields in Big Blinds (BB) for Cash games
    const [modalMinBuyInBB, setModalMinBuyInBB] = useState(20); // 20 BB default
    const [modalMaxBuyInBB, setModalMaxBuyInBB] = useState(100); // 100 BB default

    // Sit & Go settings — the chain requires them (ui#690: without them the SDK throws
    // "sit-and-go games require an sngConfig"). Same presets as /admin/tables.
    const [modalStartingStack, setModalStartingStack] = useState(1500);
    const [modalBlindLevelDuration, setModalBlindLevelDuration] = useState(10);
    const [modalSngBlindsIndex, setModalSngBlindsIndex] = useState(1); // 25 / 50

    // Cash blinds are dollars (BLIND_LEVELS); Sit & Go blinds are chips (SNG_BLINDS).
    const isModalTournament = isTournamentFormat(modalGameFormat);
    const modalSmallBlind = useMemo(
        () => (isModalTournament ? SNG_BLINDS[modalSngBlindsIndex].smallBlind : BLIND_LEVELS[selectedBlindLevel].smallBlind),
        [isModalTournament, modalSngBlindsIndex, selectedBlindLevel]
    );
    const modalBigBlind = useMemo(
        () => (isModalTournament ? SNG_BLINDS[modalSngBlindsIndex].bigBlind : BLIND_LEVELS[selectedBlindLevel].bigBlind),
        [isModalTournament, modalSngBlindsIndex, selectedBlindLevel]
    );

    // Calculate actual buy-in values from BB using utility function
    const { minBuyIn: calculatedMinBuyIn, maxBuyIn: calculatedMaxBuyIn } = useMemo(
        () => calculateBuyIn({ minBuyInBB: modalMinBuyInBB, maxBuyInBB: modalMaxBuyInBB, bigBlind: modalBigBlind }),
        [modalMinBuyInBB, modalMaxBuyInBB, modalBigBlind]
    );

    // Withdrawal Modal
    const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

    // USDC Deposit Modal
    const [showUSDCDepositModal, setShowUSDCDepositModal] = useState(false);

    // Cosmos wallet state and hooks
    const cosmosWallet = useCosmosWallet();
    const [showCosmosImportModal, setShowCosmosImportModal] = useState(false);
    const [showCosmosTransferModal, setShowCosmosTransferModal] = useState(false);
    const [showWalletGeneratedNotification, setShowWalletGeneratedNotification] = useState(false);
    const [showNewWalletModal, setShowNewWalletModal] = useState(false);
    const [newWalletSeedPhrase, setNewWalletSeedPhrase] = useState("");
    const [newWalletAddress, setNewWalletAddress] = useState("");
    const [isCreatingWallet, setIsCreatingWallet] = useState(false);
    const [seedPhraseCopied, setSeedPhraseCopied] = useState(false);

    const [cosmosSeedPhrase, setCosmosSeedPhrase] = useState("");
    const [cosmosImportError, setCosmosImportError] = useState("");
    const [transferRecipient, setTransferRecipient] = useState("");
    const [transferAmount, setTransferAmount] = useState("");
    const [transferError, setTransferError] = useState("");
    const [isTransferring, setIsTransferring] = useState(false);

    // Password validation function
    const handlePasswordSubmit = () => {
        utilHandlePasswordSubmit(passwordInput, setIsAuthenticated, setPasswordError, setPasswordInput);
    };

    // Handle Enter key press in password input
    const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
        utilHandlePasswordKeyPress(e, passwordInput, setIsAuthenticated, setPasswordError, setPasswordInput);
    };

    // Check for existing auth cookie on component mount
    useEffect(() => {
        if (passwordEnabled && checkAuthCookie()) {
            setIsAuthenticated(true);
        }
    }, [passwordEnabled]);

    const DEFAULT_GAME_CONTRACT = "0x4c1d6ea77a2ba47dcd0771b7cde0df30a6df1bfaa7"; // Example address

    // Function to handle creating a new game using Cosmos blockchain
    // Paid table name (poker-vm#337): live cost preview + validation. We normalize
    // to the chain's canonical form (trim + lowercase, ENS-style) so the preview,
    // fee, and submitted value all match what the chain validates/charges/stores.
    const normalizedTableName = useMemo(() => normalizeTableName(modalTableName), [modalTableName]);
    const tableNameError = useMemo(() => validateTableName(modalTableName), [modalTableName]);
    const tableNameFeeUsd = useMemo(() => microToUsdc(computeGameNameFee(normalizedTableName)), [normalizedTableName]);

    const handleCreateNewGame = async () => {
        // Check for Cosmos wallet
        if (!cosmosWallet.address) {
            setCreateGameError("No Block52 wallet found. Please create or import a Block52 wallet first.");
            return;
        }

        setCreateGameError("");

        try {
            // Build game options from modal selections
            // For Sit & Go/Tournament, use the same value for min and max buy-in
            const isTournament = isTournamentFormat(modalGameFormat);

            // Log the modal values before creating game options

            const gameOptions: CreateTableOptions = {
                format: modalGameFormat,
                minBuyIn: isTournament ? modalSitAndGoBuyIn : calculatedMinBuyIn,
                maxBuyIn: isTournament ? modalSitAndGoBuyIn : calculatedMaxBuyIn,
                minPlayers: modalGameFormat === GameFormat.CASH ? modalMinPlayers : modalPlayerCount,
                maxPlayers: modalGameFormat === GameFormat.CASH ? modalMaxPlayers : modalPlayerCount,
                smallBlind: modalSmallBlind,
                bigBlind: modalBigBlind,
                name: normalizedTableName || undefined,
                ...(isTournament && { sng: { startingStack: modalStartingStack, blindLevelDuration: modalBlindLevelDuration } })
            };

            // Use the createTable function from the hook (Cosmos SDK)
            const txHash = await createTable(gameOptions);

            if (txHash) {
                setShowCreateGameModal(false);
                setModalTableName("");
                // The chain just debited the creation (+ name) fee — show the real balance.
                void cosmosWallet.refreshBalance();
            }
        } catch (error) {
            console.error("Error creating game:", error);
            setCreateGameError(error instanceof Error ? error.message : "An unexpected error occurred");
        }
    };

    // Cosmos wallet handlers
    const handleImportCosmosSeed = async () => {
        try {
            setCosmosImportError("");

            if (!isValidSeedPhrase(cosmosSeedPhrase)) {
                setCosmosImportError("Please enter a valid seed phrase (12, 15, 18, 21, or 24 words)");
                return;
            }

            await cosmosWallet.importSeedPhrase(cosmosSeedPhrase);

            // Reset form and close modal
            setCosmosSeedPhrase("");
            setCosmosImportError("");
            setShowCosmosImportModal(false);
        } catch (err) {
            console.error("Failed to import cosmos seed phrase:", err);
            setCosmosImportError("Failed to import seed phrase");
        }
    };

    // Removed: handleUpdateCosmosSeed - now handled on /wallet page

    // Create new wallet handler - generates wallet and shows seed phrase
    const handleCreateNewWallet = async () => {
        try {
            setIsCreatingWallet(true);
            setSeedPhraseCopied(false);

            // Generate new wallet
            const walletInfo = await generateWalletSDK("b52", 24);

            // Store the seed phrase and address for display
            setNewWalletSeedPhrase(walletInfo.mnemonic);
            setNewWalletAddress(walletInfo.address);

            // Show the modal with seed phrase
            setShowNewWalletModal(true);
        } catch (err) {
            console.error("Failed to generate new wallet:", err);
        } finally {
            setIsCreatingWallet(false);
        }
    };

    // Confirm and save the new wallet
    const handleConfirmNewWallet = async () => {
        try {
            // Import the generated seed phrase to save it
            await cosmosWallet.importSeedPhrase(newWalletSeedPhrase);

            // Close modal and reset state
            setShowNewWalletModal(false);
            setNewWalletSeedPhrase("");
            setNewWalletAddress("");
            setSeedPhraseCopied(false);

            // Show success notification
            setShowWalletGeneratedNotification(true);
            setTimeout(() => setShowWalletGeneratedNotification(false), 10000);
        } catch (err) {
            console.error("Failed to save new wallet:", err);
        }
    };

    // Copy seed phrase to clipboard
    const handleCopySeedPhrase = () => {
        navigator.clipboard.writeText(newWalletSeedPhrase);
        setSeedPhraseCopied(true);
    };

    const handleCosmosTransfer = async () => {
        try {
            setTransferError("");
            setIsTransferring(true);

            if (!transferRecipient || !transferAmount) {
                setTransferError("Please enter recipient address and amount");
                return;
            }

            if (!B52_ADDRESS_REGEX.test(transferRecipient)) {
                setTransferError("Please enter a valid b52 bech32 address");
                return;
            }

            const amount = parseFloat(transferAmount);
            if (isNaN(amount) || amount <= 0) {
                setTransferError("Please enter a valid amount");
                return;
            }

            // Convert to smallest unit (6 decimals for USDC)
            const amountInSmallestUnit = usdcToMicroBigInt(amount).toString();

            const txHash = await cosmosWallet.sendTokens(transferRecipient, amountInSmallestUnit, "usdc");

            // Reset form and close modal
            setTransferRecipient("");
            setTransferAmount("");
            setTransferError("");
            setShowCosmosTransferModal(false);
        } catch (err) {
            console.error("Failed to send:", err);
            setTransferError(err instanceof Error ? err.message : "Failed to send");
        } finally {
            setIsTransferring(false);
        }
    };

    // Get USDC balance for transfer
    const getTransferTokenBalance = useCallback(() => {
        const balance = cosmosWallet.balance.find(b => b.denom === "usdc");
        if (balance) {
            return formatMicroAsUsdc(balance.amount, 6);
        }
        return "0.00";
    }, [cosmosWallet.balance]);

    // Numeric USDC balance for transfer validation
    const numericUsdcBalance = useMemo(() => {
        const balance = cosmosWallet.balance.find(b => b.denom === "usdc");
        return balance ? microToUsdc(balance.amount) : 0;
    }, [cosmosWallet.balance]);

    // Block table creation if the name is invalid, or the creator can't cover the
    // naming fee (the definite creation-time debit, poker-vm#337).
    const insufficientForName = tableNameFeeUsd > numericUsdcBalance;

    // Table creation fee = 10 big blinds (pokerchain#378, ui#690), priced from the
    // exact values handleCreateNewGame submits. null = the chain could not price it.
    const creationFeeMicro = useMemo(
        () =>
            computeTableCreationFeeMicro(
                modalGameFormat,
                modalSmallBlind,
                modalBigBlind,
                isModalTournament ? modalSitAndGoBuyIn : calculatedMinBuyIn,
                isModalTournament ? modalStartingStack : undefined
            ),
        [modalGameFormat, modalSmallBlind, modalBigBlind, isModalTournament, modalSitAndGoBuyIn, calculatedMinBuyIn, modalStartingStack]
    );
    const creationTotalMicro = creationFeeMicro === null ? null : creationFeeMicro + computeGameNameFee(normalizedTableName);
    const insufficientForCreation =
        creationTotalMicro === null || creationTotalMicro > usdcToMicroBigInt(numericUsdcBalance);
    const createDisabled = isCreatingTable || !!tableNameError || insufficientForName || insufficientForCreation;

    const handleCancelCreateGame = () => {
        setShowCreateGameModal(false);
        setCreateGameError("");
        setModalTableName("");
    };

    // Check if transfer amount exceeds available balance
    const isAmountExceedingBalance = useMemo(() => {
        const amount = parseFloat(transferAmount);
        if (isNaN(amount) || amount <= 0) return false;
        return amount > numericUsdcBalance;
    }, [transferAmount, numericUsdcBalance]);

    // Validate recipient is a valid b52 bech32 address
    const isValidRecipient = useMemo(() => {
        if (!transferRecipient) return false;
        return B52_ADDRESS_REGEX.test(transferRecipient);
    }, [transferRecipient]);

    // Auto-switch to Ethereum Mainnet when wallet connects
    useEffect(() => {
        const autoSwitchToEthereum = async () => {
            if (isConnected && chain?.id !== ETH_CHAIN_ID && switchChain) {
                try {
                    await switchChain.mutateAsync({ chainId: ETH_CHAIN_ID });
                } catch (err) {
                    // Don't show error to user - they can manually switch if needed
                }
            }
        };

        autoSwitchToEthereum();
    }, [isConnected, chain?.id, switchChain]);

    // Memoized Deposit callback - always open modal; crypto payments don't need Web3 wallet
    const handleDepositClick = useCallback(() => {
        setShowUSDCDepositModal(true);
    }, []);

    // Memoized Withdrawal callback
    const handleWithdrawClick = useCallback(() => {
        setShowWithdrawalModal(true);
    }, []);

    // Removed: handleImportModalClick - no longer needed (using Cosmos wallet)

    // Memoized game selection callbacks
    // Removed: Game selection button handlers - no longer needed

    return (
        <div className="min-h-screen flex flex-col relative bg-surface-page text-ink-body">

            {/* Wallet Generated Notification */}
            {showWalletGeneratedNotification && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
                    <div className={`px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 ${styles.walletGeneratedNotice}`}>
                        <span className="text-2xl">🎉</span>
                        <div>
                            <p className="text-white font-bold">Block52 Wallet Created!</p>
                            <p className="text-white/80 text-sm">
                                Visit{" "}
                                <a href="/wallet" className="underline font-semibold hover:text-white">
                                    /wallet
                                </a>{" "}
                                to view your seed phrase and manage your wallet.
                            </p>
                        </div>
                        <button onClick={() => setShowWalletGeneratedNotification(false)} className="text-white/80 hover:text-white ml-2">
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Password Protection Modal (blocking: no close, no backdrop dismiss) */}
            {!isAuthenticated && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-label="Secure Access" className="w-full max-w-[400px] max-h-full overflow-y-auto bg-surface-card border border-line rounded-2xl p-8 shadow-2xl">
                        <div className="flex items-center justify-center mb-5">
                            <img src="/block52.png" alt="Block52 Logo" className="h-14 w-auto object-contain" />
                        </div>

                        <div className="flex items-center justify-center mb-5">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-brand/10 text-brand-light">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-2xl font-semibold text-ink text-center mb-2">Secure Access</h2>
                        <p className="text-ink-muted text-center mb-6 text-sm">Enter password to access the Block52 demo</p>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={passwordInput}
                                    onChange={e => setPasswordInput(e.target.value)}
                                    onKeyDown={handlePasswordKeyPress}
                                    className={`${inputClass} h-12 pr-12 placeholder:text-ink-muted/70`}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                                            />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {passwordError && (
                                <p role="alert" className={`${noticeClass.error} text-center`}>
                                    {passwordError}
                                </p>
                            )}

                            <PillButton variant="primary" size="lg" onClick={handlePasswordSubmit} className="w-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                    />
                                </svg>
                                Access Platform
                            </PillButton>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-ink-muted">Block52 Blockchain Infrastructure Demo</p>
                            <p className="mt-2 text-xs text-ink-muted">Secured by Block52</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Dashboard Content - Only show when authenticated */}
            {isAuthenticated && (
                <>
                    {/* Import B52 Wallet Seed Phrase Modal */}
                    <Modal
                        isOpen={showCosmosImportModal}
                        onClose={() => {
                            setShowCosmosImportModal(false);
                            setCosmosSeedPhrase("");
                            setCosmosImportError("");
                        }}
                        title="Import B52 Wallet Seed Phrase"
                        widthClass="w-[480px]"
                        isProcessing={cosmosWallet.isLoading}
                    >
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="cosmos-seed-phrase" className={fieldLabelClass}>
                                    Seed Phrase
                                </label>
                                <textarea
                                    id="cosmos-seed-phrase"
                                    placeholder="Enter your 12, 15, 18, 21, or 24 word seed phrase..."
                                    value={cosmosSeedPhrase}
                                    onChange={e => setCosmosSeedPhrase(e.target.value)}
                                    className={`${fieldInputClass} h-28 py-3 font-mono text-sm resize-none`}
                                />
                                <p className="text-xs text-ink-muted mt-1.5">Words should be separated by spaces</p>
                            </div>
                            {cosmosImportError && (
                                <p role="alert" className={noticeClass.error}>
                                    {cosmosImportError}
                                </p>
                            )}
                            <div className="flex flex-col gap-2 pt-1">
                                <PillButton variant="primary" size="lg" onClick={handleImportCosmosSeed} disabled={cosmosWallet.isLoading} className="w-full">
                                    {cosmosWallet.isLoading ? "Importing..." : "Import"}
                                </PillButton>
                                <PillButton
                                    variant="ghost"
                                    size="lg"
                                    onClick={() => {
                                        setShowCosmosImportModal(false);
                                        setCosmosSeedPhrase("");
                                        setCosmosImportError("");
                                    }}
                                    className="w-full"
                                >
                                    Cancel
                                </PillButton>
                            </div>
                        </div>
                    </Modal>

                    {/* Removed: Cosmos Update Seed Phrase Modal - now handled on /wallet page */}

                    {/* New B52 Wallet Created Modal - shows seed phrase */}
                    <Modal
                        isOpen={showNewWalletModal}
                        onClose={() => {
                            setShowNewWalletModal(false);
                            setNewWalletSeedPhrase("");
                            setNewWalletAddress("");
                            setSeedPhraseCopied(false);
                        }}
                        title="New B52 Wallet Created"
                        widthClass="w-[520px]"
                        closeOnEscape={false}
                        closeOnBackdropClick={false}
                    >
                        <div className="space-y-4">
                            <p className="text-ink-muted text-sm">
                                Write down your seed phrase and store it in a safe place. You will need it to recover your wallet.
                            </p>

                            {/* Warning */}
                            <div className={`${noticeClass.warning} flex items-start gap-3`}>
                                <WarningIcon className="w-5 h-5 shrink-0 mt-px" />
                                <p className="m-0">Never share your seed phrase with anyone. Anyone with this phrase can access your funds.</p>
                            </div>

                            {/* Address */}
                            <div>
                                <span className={fieldLabelClass}>Wallet Address</span>
                                <div className={`${insetBoxClass} font-mono text-sm text-ink break-all`}>{newWalletAddress}</div>
                            </div>

                            {/* Seed Phrase */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Seed Phrase (24 words)</span>
                                    <button
                                        type="button"
                                        onClick={handleCopySeedPhrase}
                                        className={`${inlinePillClass} inline-flex items-center gap-1.5 ${seedPhraseCopied ? "text-emerald-400" : ""}`}
                                        title="Copy seed phrase"
                                    >
                                        {seedPhraseCopied ? (
                                            <>
                                                <CheckIcon className="w-3.5 h-3.5" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <CopyIcon className="w-3.5 h-3.5" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {newWalletSeedPhrase.split(" ").map((word, index) => (
                                        <div key={index} className="flex items-center gap-2 px-3 h-10 rounded-xl bg-surface-raised border border-line font-mono text-sm text-ink min-w-0">
                                            <span className="text-ink-muted text-xs w-5 shrink-0 tabular-nums">{index + 1}.</span>
                                            <span className="truncate">{word}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 pt-1">
                                <label className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl border border-line bg-surface-raised cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={seedPhraseCopied}
                                        onChange={e => setSeedPhraseCopied(e.target.checked)}
                                        className="w-5 h-5 shrink-0 accent-brand"
                                    />
                                    <span className="text-ink-body text-sm py-2">I have written down my seed phrase and stored it safely</span>
                                </label>
                                <PillButton variant="primary" size="lg" onClick={handleConfirmNewWallet} disabled={!seedPhraseCopied} className="w-full">
                                    I've Saved My Seed Phrase
                                </PillButton>
                                <PillButton
                                    variant="ghost"
                                    size="lg"
                                    onClick={() => {
                                        setShowNewWalletModal(false);
                                        setNewWalletSeedPhrase("");
                                        setNewWalletAddress("");
                                        setSeedPhraseCopied(false);
                                    }}
                                    className="w-full"
                                >
                                    Cancel
                                </PillButton>
                            </div>
                        </div>
                    </Modal>

                    {/* USDC Transfer Modal */}
                    <SendModal
                        isOpen={showCosmosTransferModal}
                        balanceDisplay={getTransferTokenBalance()}
                        recipient={transferRecipient}
                        amount={transferAmount}
                        error={transferError}
                        isSending={isTransferring}
                        isValidRecipient={isValidRecipient}
                        isAmountExceedingBalance={isAmountExceedingBalance}
                        onRecipientChange={setTransferRecipient}
                        onAmountChange={setTransferAmount}
                        onSend={handleCosmosTransfer}
                        onCancel={() => {
                            setShowCosmosTransferModal(false);
                            setTransferRecipient("");
                            setTransferAmount("");
                            setTransferError("");
                        }}
                    />

                    {/* Create New Game Modal */}
                    {showCreateGameModal && (
<Modal
                            isOpen
                            onClose={handleCancelCreateGame}
                            title="Create New Table"
                            widthClass="w-full max-w-[480px]"
                            isProcessing={isCreatingTable}
                            closeOnBackdropClick={false}
                        >
                                <div className="space-y-5">
                                    <div>
                                        <label className={labelClass}>Game Type</label>
                                        <select
                                            value={modalGameFormat}
                                            onChange={e => {
                                                const format = toGameFormat(e.target.value);
                                                if (format) setModalGameFormat(format);
                                            }}
                                            className={inputClass}
                                        >
                                            <option value={GameFormat.SIT_AND_GO}>Sit & Go</option>
                                            <option value={GameFormat.CASH}>Cash Game</option>
                                            <option value={GameFormat.TOURNAMENT}>Tournament</option>
                                        </select>
                                    </div>

                                    {/* Optional paid table name (poker-vm#337): $0.10/char, live preview */}
                                    <div>
                                        <label className={labelClass}>
                                            Table Name <span className="normal-case tracking-normal text-ink-muted">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={modalTableName}
                                            onChange={e => setModalTableName(e.target.value)}
                                            placeholder="e.g. friday-degens"
                                            className={inputClass}
                                        />
                                        {tableNameError ? (
                                            <p className="text-xs text-red-400 mt-1">{tableNameError}</p>
                                        ) : normalizedTableName.length > 0 ? (
                                            <p className="text-xs text-ink-muted mt-1.5">
                                                {tableNameCharCount(normalizedTableName)} characters × $0.10 ={" "}
                                                <span className="text-ink font-semibold">${tableNameFeeUsd.toFixed(2)}</span>
                                                {/* Show the canonical form the chain stores when it differs from the raw input. */}
                                                {normalizedTableName !== modalTableName && (
                                                    <span className="text-ink-muted"> — saved as “{normalizedTableName}”</span>
                                                )}
                                                {insufficientForName && (
                                                    <span className="text-red-400"> — exceeds your ${numericUsdcBalance.toFixed(2)} balance</span>
                                                )}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-ink-muted mt-1.5">Free if left blank. Lowercase a–z, 0–9 and hyphens; $0.10 per character.</p>
                                        )}
                                    </div>

                                    {modalGameFormat === GameFormat.CASH ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>Min Players</label>
                                                <input
                                                    type="number"
                                                    min={2}
                                                    max={9}
                                                    value={modalMinPlayers ?? 2}
                                                    onChange={e => setModalMinPlayers(Number(e.target.value))}
                                                    className={inputClass}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Max Players</label>
                                                <input
                                                    type="number"
                                                    min={2}
                                                    max={9}
                                                    value={modalMaxPlayers ?? 9}
                                                    onChange={e => setModalMaxPlayers(Number(e.target.value))}
                                                    className={inputClass}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className={labelClass}>Number of Players</label>
                                            <select
                                                value={modalPlayerCount}
                                                onChange={e => setModalPlayerCount(Number(e.target.value))}
                                                className={inputClass}
                                            >
                                                <option value={2}>2 Players (Heads-Up)</option>
                                                <option value={4}>4 Players (Sit & Go)</option>
                                                <option value={6}>6 Players (Sit & Go)</option>
                                                <option value={9}>9 Players (Full Ring)</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Show different fields based on game format */}
                                    {isTournamentFormat(modalGameFormat) ? (
                                        // For Sit & Go and Tournament: Single buy-in field
                                        <div>
                                            <label className={labelClass}>Tournament Buy-In ($)</label>
                                            <input
                                                type="number"
                                                value={modalSitAndGoBuyIn}
                                                onChange={e => setModalSitAndGoBuyIn(Number(e.target.value))}
                                                min="10"
                                                max="10"
                                                className={inputClass}
                                            />
                                            <p className="text-xs text-ink-muted mt-1.5">All players pay the same buy in</p>
                                            <label className={`${labelClass} mt-4`}>Starting Stack (chips)</label>
                                            <select
                                                value={modalStartingStack}
                                                onChange={e => setModalStartingStack(Number(e.target.value))}
                                                className={inputClass}
                                            >
                                                <option value={1000}>Turbo (1,000)</option>
                                                <option value={1500}>Standard (1,500)</option>
                                                <option value={3000}>Deep Stack (3,000)</option>
                                            </select>
                                            <label className={`${labelClass} mt-4`}>Starting Blinds (chips)</label>
                                            <select
                                                value={modalSngBlindsIndex}
                                                onChange={e => setModalSngBlindsIndex(Number(e.target.value))}
                                                className={inputClass}
                                            >
                                                {SNG_BLINDS.map((b, i) => (
                                                    <option key={b.bigBlind} value={i}>
                                                        {b.smallBlind} / {b.bigBlind}
                                                    </option>
                                                ))}
                                            </select>
                                            <label className={`${labelClass} mt-4`}>Blind Level Duration</label>
                                            <select
                                                value={modalBlindLevelDuration}
                                                onChange={e => setModalBlindLevelDuration(Number(e.target.value))}
                                                className={inputClass}
                                            >
                                                <option value={3}>Hyper (3 min)</option>
                                                <option value={5}>Turbo (5 min)</option>
                                                <option value={10}>Standard (10 min)</option>
                                                <option value={15}>Deep (15 min)</option>
                                            </select>
                                        </div>
                                    ) : (
                                        // For Cash games: Blind level and buy-in in Big Blinds (BB)
                                        <>
                                            {/* Blind Level Dropdown - Cash games only */}
                                            <div>
                                                <label className={labelClass}>Game Size (Small Blind / Big Blind)</label>
                                                <select
                                                    value={selectedBlindLevel}
                                                    onChange={e => setSelectedBlindLevel(Number(e.target.value))}
                                                    className={inputClass}
                                                >
                                                    {BLIND_LEVELS.map((level, index) => (
                                                        <option key={index} value={index}>
                                                            {level.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Preset buttons */}
                                            <div>
                                                <label className={labelClass}>Buy-In Presets</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalMinBuyInBB(20);
                                                            setModalMaxBuyInBB(100);
                                                        }}
                                                        className={`h-9 px-3.5 text-xs font-medium rounded-full transition-colors ${
                                                            modalMinBuyInBB === 20 && modalMaxBuyInBB === 100
                                                                ? "bg-brand text-white border border-brand"
                                                                : "border border-line-strong text-ink-soft hover:bg-surface-hover"
                                                        }`}
                                                    >
                                                        Standard (20-100 BB)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalMinBuyInBB(40);
                                                            setModalMaxBuyInBB(200);
                                                        }}
                                                        className={`h-9 px-3.5 text-xs font-medium rounded-full transition-colors ${
                                                            modalMinBuyInBB === 40 && modalMaxBuyInBB === 200
                                                                ? "bg-brand text-white border border-brand"
                                                                : "border border-line-strong text-ink-soft hover:bg-surface-hover"
                                                        }`}
                                                    >
                                                        Deep (40-200 BB)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalMinBuyInBB(100);
                                                            setModalMaxBuyInBB(300);
                                                        }}
                                                        className={`h-9 px-3.5 text-xs font-medium rounded-full transition-colors ${
                                                            modalMinBuyInBB === 100 && modalMaxBuyInBB === 300
                                                                ? "bg-brand text-white border border-brand"
                                                                : "border border-line-strong text-ink-soft hover:bg-surface-hover"
                                                        }`}
                                                    >
                                                        Deep Stack (100-300 BB)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Buy-in inputs in BB */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>Minimum Buy-In (BB)</label>
                                                    <input
                                                        type="number"
                                                        value={modalMinBuyInBB}
                                                        onChange={e => setModalMinBuyInBB(Number(e.target.value))}
                                                        min="20"
                                                        max="500"
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Maximum Buy-In (BB)</label>
                                                    <input
                                                        type="number"
                                                        value={modalMaxBuyInBB}
                                                        onChange={e => setModalMaxBuyInBB(Number(e.target.value))}
                                                        min="20"
                                                        max="500"
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>

                                            {/* Calculated buy-in preview */}
                                            {modalBigBlind > 0 && (
                                                <div className="bg-surface-raised rounded-xl p-3 border border-line">
                                                    <p className="text-xs text-ink-muted mb-1">Calculated Buy-In Range:</p>
                                                    <p className="text-sm text-emerald-400">
                                                        ${calculatedMinBuyIn.toFixed(2)} - ${calculatedMaxBuyIn.toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-ink-muted mt-1">Based on ${modalBigBlind.toFixed(2)} BB</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div>
                                        <label className={labelClass}>Variant</label>
                                        <select
                                            value={selectedContractAddress}
                                            onChange={e => setSelectedContractAddress(e.target.value)}
                                            className={inputClass}
                                        >
                                            <React.Fragment>
                                                <option value={DEFAULT_GAME_CONTRACT}>Texas Hold'em</option>
                                                <option value="" disabled>
                                                    Omaha (Coming Soon)
                                                </option>
                                                <option value="" disabled>
                                                    Seven Card Stud (Coming Soon)
                                                </option>
                                                <option value="" disabled>
                                                    Blackjack (Coming Soon)
                                                </option>
                                            </React.Fragment>
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-raised border border-line px-3.5 py-3 text-sm">
                                        <span className="text-ink-muted">Table Creation Fee ({CREATION_FEE_BIG_BLINDS.toString()} big blinds)</span>
                                        <span className="text-ink font-mono shrink-0">
                                            {creationFeeMicro === null ? "—" : `$${formatMicroAsUsdc(creationFeeMicro.toString(), 6)}`}
                                        </span>
                                    </div>
                                    {insufficientForCreation && creationTotalMicro !== null && (
                                        <p className="text-red-400 text-sm">
                                            You need ${formatMicroAsUsdc(creationTotalMicro.toString(), 6)} to create this table (fee
                                            {normalizedTableName.length > 0 ? " + name" : ""}); your balance is ${numericUsdcBalance.toFixed(6)}.
                                        </p>
                                    )}

                                    {createGameError && <p role="alert" className={errorBoxClass}>{createGameError}</p>}
                                    {createTableError && <p role="alert" className={errorBoxClass}>{createTableError.message}</p>}

                                    <div className="flex flex-col gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleCreateNewGame}
                                            disabled={createDisabled}
                                            className="h-12 w-full rounded-full bg-brand text-white font-semibold flex items-center justify-center transition-colors hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light"
                                        >
                                            {isCreatingTable ? (
                                                <>
                                                    <svg
                                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        ></path>
                                                    </svg>
                                                    Creating Table...
                                                </>
                                            ) : (
                                                "Create Game"
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelCreateGame}
                                            className="h-11 w-full rounded-full text-sm font-medium text-ink-soft hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                        </Modal>
                    )}

                    {/* Lobby layout. Desktop (lg+): left column = Wallet over Transactions (380px),
                        right column = Tables spanning both rows. Phones: one column in DOM order
                        Wallet, Tables, Transactions. */}
                    <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col min-h-[calc(100vh-73px)]">
                        <div className="grid grid-cols-1 gap-5 lg:gap-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] items-start">
                            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                                <WalletPanel
                                    onDeposit={handleDepositClick}
                                    onWithdraw={handleWithdrawClick}
                                    onTransfer={() => setShowCosmosTransferModal(true)}
                                    onCreateWallet={handleCreateNewWallet}
                                    onImportWallet={() => setShowCosmosImportModal(true)}
                                    onRefresh={cosmosWallet.refreshBalance}
                                    usdcBalance={getTransferTokenBalance()}
                                    cosmosWalletAddress={cosmosWallet.address}
                                />
                            </div>

                            <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                                <TableList
                                    onCreateTable={() => {
                                        setCreateGameError("");
                                        setShowCreateGameModal(true);
                                    }}
                                />
                            </div>

                            <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                                <TransactionPanel
                                    cosmosWalletAddress={cosmosWallet.address}
                                    usdcBalance={getTransferTokenBalance()}
                                    onDeposit={handleDepositClick}
                                />
                            </div>
                        </div>

                        <PoweredBy />
                    </main>

                    {/* Reset blockchain button was here, now commented out by user */}

                    {showWithdrawalModal && (
                        <WithdrawalModal
                            isOpen={showWithdrawalModal}
                            onClose={() => setShowWithdrawalModal(false)}
                            onSuccess={() => {
                                // Balance will auto-refresh on next page interaction
                            }}
                        />
                    )}
                    {showUSDCDepositModal && (
                        <USDCDepositModal
                            isOpen={showUSDCDepositModal}
                            onClose={() => setShowUSDCDepositModal(false)}
                            onSuccess={() => {
                                // Balance will auto-refresh on next page interaction
                                setShowUSDCDepositModal(false);
                            }}
                        />
                    )}

                    {/* Welcome modal: lists the next scheduled Sit & Go tournaments once per browser */}
                    <UpcomingSngModal />
                </>
            )}
        </div>
    );
};

export default Dashboard;
