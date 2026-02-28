import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation

import "./Dashboard.css"; // Import the CSS file with animations
import styles from "./Dashboard.module.css";

// Ethereum Mainnet imports (for auto-switch to correct chain)
import { ETH_CHAIN_ID } from "../config/constants";
import { useAccount as useWagmiAccount, useSwitchChain } from "wagmi";

import { calculateBuyIn } from "../utils/buyInUtils";
import { BLIND_LEVELS, DEFAULT_BLIND_LEVEL_INDEX } from "../constants/blindLevels";
import { usdcToMicroBigInt, formatMicroAsUsdc, microToUsdc } from "../constants/currency";

import { WithdrawalModal, USDCDepositModal } from "../components/modals";
import TableList from "../components/TableList";
import WalletPanel from "../components/WalletPanel";
import TransactionPanel from "../components/TransactionPanel";
import { AnimatedBackground } from "../components/common";

// Game wallet and SDK imports
// ...existing code...
import { GameFormat, generateWallet as generateWalletSDK } from "@block52/poker-vm-sdk";

// Hook imports from barrel file
import { useUserWalletConnect, useNewTable, useCosmosWallet } from "../hooks";
import type { CreateTableOptions } from "../hooks/game/useNewTable"; // Import type separately

// Cosmos wallet utils
import { isValidSeedPhrase } from "../utils/cosmos";
import { isTournamentFormat } from "../utils/gameFormatUtils";

// Password protection utils
import {
    checkAuthCookie,
    handlePasswordSubmit as utilHandlePasswordSubmit,
    handlePasswordKeyPress as utilHandlePasswordKeyPress
} from "../utils/passwordProtectionUtils";

// Club branding imports
import { colors, hexToRgba } from "../utils/colorConfig";

// Bech32 address regex: "b52" prefix + "1" separator + valid bech32 data characters
const B52_ADDRESS_REGEX = /^b521[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    // Removed: Game selection state variables - now handled in Create Game modal
    // Removed: Ethereum wallet state - now using Cosmos wallet only

    // Password protection states
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [passwordInput, setPasswordInput] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const { isConnected, open, address } = useUserWalletConnect();

    // Wagmi hooks for Ethereum Mainnet (USDC deposit bridge)
    const { chain } = useWagmiAccount();
    const { switchChain } = useSwitchChain();

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

    // Get current blind values from selected level (memoized to prevent unnecessary recalculation)
    const modalSmallBlind = useMemo(() => BLIND_LEVELS[selectedBlindLevel].smallBlind, [selectedBlindLevel]);
    const modalBigBlind = useMemo(() => BLIND_LEVELS[selectedBlindLevel].bigBlind, [selectedBlindLevel]);

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
        if (checkAuthCookie()) {
            setIsAuthenticated(true);
        }
    }, []);

    const DEFAULT_GAME_CONTRACT = "0x4c1d6ea77a2ba47dcd0771b7cde0df30a6df1bfaa7"; // Example address

    // Function to handle creating a new game using Cosmos blockchain
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
                bigBlind: modalBigBlind
            };

            // Use the createTable function from the hook (Cosmos SDK)
            const txHash = await createTable(gameOptions);

            if (txHash) {
                setShowCreateGameModal(false);
            }
        } catch (error: any) {
            console.error("Error creating game:", error);
            setCreateGameError(error.message || "An unexpected error occurred");
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
                    await switchChain({ chainId: ETH_CHAIN_ID });
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
        <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden">
            {/* Animated background with hexagon pattern */}
            <AnimatedBackground />

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

            {/* Password Protection Modal */}
            {!isAuthenticated && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className={`backdrop-blur-md p-8 rounded-xl w-96 shadow-2xl relative overflow-hidden ${styles.passwordModal}`}>
                        {/* Web3 styled background */}
                        <div className={`absolute inset-0 rounded-xl ${styles.passwordModalOverlay}`}></div>
                        <div className={`absolute top-0 left-0 w-full h-1 animate-pulse ${styles.passwordModalTopBar}`}></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-center mb-4">
                                <img src="/block52.png" alt="Block52 Logo" className="h-16 w-auto object-contain" />
                            </div>

                            <div className="flex items-center justify-center mb-6">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${styles.passwordIconCircle}`}>
                                    <svg className={`w-8 h-8 ${styles.brandPrimaryText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                    </svg>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-white text-center mb-2 text-shadow">Secure Access</h2>
                            <p className="text-gray-300 text-center mb-6 text-sm">Enter password to access the Block52 demo</p>

                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter password"
                                        value={passwordInput}
                                        onChange={e => setPasswordInput(e.target.value)}
                                        onKeyDown={handlePasswordKeyPress}
                                        className={`w-full p-3 rounded-lg backdrop-blur-sm text-white focus:outline-none transition-all duration-200 pr-12 ${styles.passwordInput}`}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white hover:opacity-90 transition-colors"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                                                />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                                        <p className="text-red-400 text-sm text-center">{passwordError}</p>
                                    </div>
                                )}

                                <button
                                    onClick={handlePasswordSubmit}
                                    className={`w-full py-3 text-white rounded-lg transition duration-300 transform hover:scale-105 shadow-md font-semibold ${styles.passwordSubmitButton}`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                            />
                                        </svg>
                                        Access Platform
                                    </div>
                                </button>
                            </div>

                            <div className="mt-6 text-center">
                                <p className="text-xs text-gray-400">Block52 Blockchain Infrastructure Demo</p>
                                <div className="flex items-center justify-center gap-1 mt-2">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${styles.brandPrimaryDot}`}></div>
                                    <span className="text-xs text-gray-400">Secured by Block52</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Dashboard Content - Only show when authenticated */}
            {isAuthenticated && (
                <>
                    {/* Import B52 Wallet Seed Phrase Modal */}
                    {showCosmosImportModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div className={`p-6 rounded-xl w-[440px] shadow-2xl border ${styles.modalPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-2 whitespace-nowrap">Import B52 Wallet Seed Phrase</h3>
                                <div className={styles.modalTitleDivider} />
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-white text-sm mb-1">Seed Phrase</label>
                                        <textarea
                                            placeholder="Enter your 12, 15, 18, 21, or 24 word seed phrase..."
                                            value={cosmosSeedPhrase}
                                            onChange={e => setCosmosSeedPhrase(e.target.value)}
                                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 h-20 resize-none"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Words should be separated by spaces</p>
                                    </div>
                                    {cosmosImportError && <p className="text-red-500 text-sm">{cosmosImportError}</p>}
                                    <div className="flex flex-col space-y-3">
                                        <button
                                            onClick={handleImportCosmosSeed}
                                            disabled={cosmosWallet.isLoading}
                                            className={`w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition duration-300 shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${styles.brandPrimaryBg}`}
                                        >
                                            {cosmosWallet.isLoading ? "Importing..." : "Import"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowCosmosImportModal(false);
                                                setCosmosSeedPhrase("");
                                                setCosmosImportError("");
                                            }}
                                            className={`w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition duration-300 hover:opacity-80 ${styles.cancelBg}`}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Removed: Cosmos Update Seed Phrase Modal - now handled on /wallet page */}

                    {/* New B52 Wallet Created Modal - shows seed phrase */}
                    {showNewWalletModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div className={`p-6 rounded-xl w-[480px] shadow-2xl border ${styles.modalPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-2">New B52 Wallet Created</h3>
                                <div className={styles.modalTitleDivider} />
                                <p className="text-gray-400 text-sm mb-4">
                                    Write down your seed phrase and store it in a safe place. You will need it to recover your wallet.
                                </p>

                                {/* Warning */}
                                <div className={`p-3 rounded-lg mb-4 flex items-start gap-3 ${styles.dangerWarningBox}`}>
                                    <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.dangerText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                        />
                                    </svg>
                                    <p className={`text-sm ${styles.dangerText}`}>
                                        Never share your seed phrase with anyone. Anyone with this phrase can access your funds.
                                    </p>
                                </div>

                                {/* Address */}
                                <div className="mb-4">
                                    <label className="block text-gray-400 text-sm mb-1">Wallet Address</label>
                                    <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 font-mono text-sm text-white break-all">
                                        {newWalletAddress}
                                    </div>
                                </div>

                                {/* Seed Phrase with inline copy icon */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-gray-400 text-sm">Seed Phrase (24 words)</label>
                                        <button
                                            onClick={handleCopySeedPhrase}
                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:opacity-80 ${styles.copyIconBtn} ${seedPhraseCopied ? styles.copyIconBtnCopied : ""}`}
                                            title="Copy seed phrase"
                                        >
                                            {seedPhraseCopied ? (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth="2"
                                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 font-mono text-sm text-white">
                                        <div className="grid grid-cols-4 gap-2">
                                            {newWalletSeedPhrase.split(" ").map((word, index) => (
                                                <div key={index} className="flex items-center gap-1">
                                                    <span className="text-gray-500 text-xs w-5">{index + 1}.</span>
                                                    <span>{word}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col space-y-3">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={seedPhraseCopied}
                                            onChange={e => setSeedPhraseCopied(e.target.checked)}
                                            className="w-4 h-4 accent-blue-500"
                                        />
                                        <span className="text-gray-300 text-sm">I have written down my seed phrase and stored it safely</span>
                                    </label>
                                    <button
                                        onClick={handleConfirmNewWallet}
                                        disabled={!seedPhraseCopied}
                                        className={`w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition duration-300 shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${styles.brandPrimaryBg}`}
                                    >
                                        I've Saved My Seed Phrase
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewWalletModal(false);
                                            setNewWalletSeedPhrase("");
                                            setNewWalletAddress("");
                                            setSeedPhraseCopied(false);
                                        }}
                                        className={`w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition duration-300 hover:opacity-80 ${styles.cancelBg}`}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* USDC Transfer Modal */}
                    {showCosmosTransferModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div className={`p-6 rounded-xl w-96 shadow-2xl border ${styles.modalPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-4">Send</h3>
                                <div className="space-y-4">
                                    {/* Available Balance Display */}
                                    <div className={`p-3 rounded-lg ${styles.balanceBox}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Available Balance:</span>
                                            <span className={`font-bold ${styles.brandPrimaryText}`}>{getTransferTokenBalance()} USDC</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-white text-sm mb-1">Recipient Address</label>
                                        <input
                                            type="text"
                                            placeholder="b521abc..."
                                            value={transferRecipient}
                                            onChange={e => setTransferRecipient(e.target.value)}
                                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-white text-sm mb-1">Amount (USDC)</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            placeholder="0.00"
                                            value={transferAmount}
                                            onChange={e => setTransferAmount(e.target.value)}
                                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                        />
                                    </div>
                                    {transferError && <p className="text-red-500 text-sm">{transferError}</p>}
                                    <div className="flex flex-col space-y-3">
                                        <button
                                            onClick={handleCosmosTransfer}
                                            disabled={isTransferring || !isValidRecipient || !transferAmount || isAmountExceedingBalance}
                                            className={`w-full px-4 py-2 text-sm text-white rounded-lg transition duration-300 shadow-md hover:opacity-90 disabled:opacity-50 ${styles.brandPrimaryBg}`}
                                        >
                                            {isTransferring ? "Sending..." : "Send USDC"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowCosmosTransferModal(false);
                                                setTransferRecipient("");
                                                setTransferAmount("");
                                                setTransferError("");
                                            }}
                                            className={`w-full px-4 py-2 text-sm text-white rounded-lg transition duration-300 shadow-md hover:opacity-90 ${styles.cancelGradientButton}`}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create New Game Modal */}
                    {showCreateGameModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div className={`p-6 rounded-xl w-96 shadow-2xl border ${styles.modalPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-4">Create New Table</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-white text-sm mb-1">Game Type</label>
                                        <select
                                            value={modalGameFormat}
                                            onChange={e => setModalGameFormat(e.target.value as GameFormat)}
                                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                        >
                                            <option value={GameFormat.SIT_AND_GO}>Sit & Go</option>
                                            <option value={GameFormat.CASH}>Cash Game</option>
                                            <option value={GameFormat.TOURNAMENT}>Tournament</option>
                                        </select>
                                    </div>

                                    {modalGameFormat === GameFormat.CASH ? (
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-white text-sm mb-1">Min Players</label>
                                                <input
                                                    type="number"
                                                    min={2}
                                                    max={9}
                                                    value={modalMinPlayers ?? 2}
                                                    onChange={e => setModalMinPlayers(Number(e.target.value))}
                                                    className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-white text-sm mb-1">Max Players</label>
                                                <input
                                                    type="number"
                                                    min={2}
                                                    max={9}
                                                    value={modalMaxPlayers ?? 9}
                                                    onChange={e => setModalMaxPlayers(Number(e.target.value))}
                                                    className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-white text-sm mb-1">Number of Players</label>
                                            <select
                                                value={modalPlayerCount}
                                                onChange={e => setModalPlayerCount(Number(e.target.value))}
                                                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                            >
                                                <option value={4}>4 Players (Sit & Go)</option>
                                                <option value={9}>9 Players (Full Ring)</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Show different fields based on game format */}
                                    {isTournamentFormat(modalGameFormat) ? (
                                        // For Sit & Go and Tournament: Single buy-in field
                                        <div>
                                            <label className="block text-white text-sm mb-1">Tournament Buy-In ($)</label>
                                            <input
                                                type="number"
                                                value={modalSitAndGoBuyIn}
                                                onChange={e => setModalSitAndGoBuyIn(Number(e.target.value))}
                                                min="10"
                                                max="10"
                                                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">All players pay the same buy in</p>
                                        </div>
                                    ) : (
                                        // For Cash games: Blind level and buy-in in Big Blinds (BB)
                                        <>
                                            {/* Blind Level Dropdown - Cash games only */}
                                            <div>
                                                <label className="block text-white text-sm mb-1">Game Size (Small Blind / Big Blind)</label>
                                                <select
                                                    value={selectedBlindLevel}
                                                    onChange={e => setSelectedBlindLevel(Number(e.target.value))}
                                                    className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
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
                                                <label className="block text-white text-sm mb-2">Buy-In Presets</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalMinBuyInBB(20);
                                                            setModalMaxBuyInBB(100);
                                                        }}
                                                        className={`px-3 py-1 text-xs rounded transition-all duration-200 ${
                                                            modalMinBuyInBB === 20 && modalMaxBuyInBB === 100
                                                                ? "bg-blue-600 text-white"
                                                                : "bg-gray-600 text-gray-300 hover:bg-gray-500"
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
                                                        className={`px-3 py-1 text-xs rounded transition-all duration-200 ${
                                                            modalMinBuyInBB === 40 && modalMaxBuyInBB === 200
                                                                ? "bg-blue-600 text-white"
                                                                : "bg-gray-600 text-gray-300 hover:bg-gray-500"
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
                                                        className={`px-3 py-1 text-xs rounded transition-all duration-200 ${
                                                            modalMinBuyInBB === 100 && modalMaxBuyInBB === 300
                                                                ? "bg-blue-600 text-white"
                                                                : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                                                        }`}
                                                    >
                                                        Deep Stack (100-300 BB)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Buy-in inputs in BB */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-white text-sm mb-1">Minimum Buy-In (BB)</label>
                                                    <input
                                                        type="number"
                                                        value={modalMinBuyInBB}
                                                        onChange={e => setModalMinBuyInBB(Number(e.target.value))}
                                                        min="20"
                                                        max="500"
                                                        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-white text-sm mb-1">Maximum Buy-In (BB)</label>
                                                    <input
                                                        type="number"
                                                        value={modalMaxBuyInBB}
                                                        onChange={e => setModalMaxBuyInBB(Number(e.target.value))}
                                                        min="20"
                                                        max="500"
                                                        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Calculated buy-in preview */}
                                            {modalBigBlind > 0 && (
                                                <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                                                    <p className="text-xs text-gray-400 mb-1">Calculated Buy-In Range:</p>
                                                    <p className="text-sm text-green-400">
                                                        ${calculatedMinBuyIn.toFixed(2)} - ${calculatedMaxBuyIn.toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">Based on ${modalBigBlind.toFixed(2)} BB</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-white text-sm mb-1">Variant</label>
                                        <select
                                            value={selectedContractAddress}
                                            onChange={e => setSelectedContractAddress(e.target.value)}
                                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
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

                                    {createGameError && <p className="text-red-500 text-sm">{createGameError}</p>}
                                    {createTableError && <p className="text-red-500 text-sm">{createTableError.message}</p>}

                                    <div className="flex justify-end space-x-3">
                                        <button
                                            onClick={() => {
                                                setShowCreateGameModal(false);
                                                setCreateGameError("");
                                            }}
                                            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 hover:opacity-90 text-white rounded-lg transition duration-300 shadow-inner"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateNewGame}
                                            disabled={isCreatingTable}
                                            className={`px-4 py-2 text-sm text-white rounded-lg transition duration-300 shadow-md flex items-center ${
                                                isCreatingTable ? "bg-gray-500" : `${styles.brandPrimaryBg} hover:opacity-90`
                                            }`}
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Two-column layout: Wallet (fixed width) on left, Tables (flex) on right */}
                    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 z-10 mt-8 sm:mt-12 lg:mt-16">
                        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                            {/* Left column: Wallet and Transactions (fixed width) */}
                            <div className="w-full lg:w-[400px] flex-shrink-0 space-y-4">
                                <WalletPanel
                                    onDeposit={handleDepositClick}
                                    onWithdraw={handleWithdrawClick}
                                    onTransfer={() => setShowCosmosTransferModal(true)}
                                    onCreateWallet={handleCreateNewWallet}
                                    onImportWallet={() => setShowCosmosImportModal(true)}
                                    usdcBalance={getTransferTokenBalance()}
                                />
                                <TransactionPanel />
                            </div>

                            {/* Right column: Table List (takes remaining space) */}
                            <div className="flex-1 min-w-0">
                                <TableList />
                            </div>
                        </div>
                    </div>

                    {/* Reset blockchain button was here, now commented out by user */}

                    {/* Powered by Block52 */}
                    <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                        <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                            <div className="text-left mb-1">
                                <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                            </div>
                            <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                        </div>
                    </div>

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
                </>
            )}
        </div>
    );
};

export default Dashboard;
