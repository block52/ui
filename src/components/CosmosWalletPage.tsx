import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateWallet as generateWalletSDK, createWalletFromMnemonic as createWalletSDK, getAddressFromMnemonic } from "@block52/poker-vm-sdk";
import { setCosmosMnemonic, setCosmosAddress, getCosmosMnemonic, getCosmosAddress, clearCosmosData, isValidSeedPhrase } from "../utils/cosmos";
import { AnimatedBackground } from "./common/AnimatedBackground";
import useUserWalletConnect from "../hooks/wallet/useUserWalletConnect";
import styles from "./CosmosWalletPage.module.css";

// Seed phrase word grid component
const SeedPhraseGrid = ({ mnemonic, hidden = false }: { mnemonic: string; hidden?: boolean }) => {
    const words = mnemonic.split(" ");
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {words.map((word, index) => (
                <div
                    key={index}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm ${styles.seedWordCard}`}
                >
                    <span className={`text-xs ${styles.seedWordIndex}`}>{index + 1}.</span>
                    <span className="text-white">{hidden ? "••••" : word}</span>
                </div>
            ))}
        </div>
    );
};

const CosmosWalletPage = () => {
    const navigate = useNavigate();
    const { open: openWeb3Wallet, disconnect: disconnectWeb3, isConnected: isWeb3Connected, address: web3Address } = useUserWalletConnect();
    const [mnemonic, setMnemonic] = useState<string>("");
    const [address, setAddress] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [importMnemonic, setImportMnemonic] = useState("");
    const [error, setError] = useState<string>("");
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Store existing wallet in state to handle updates properly
    const [existingMnemonic, setExistingMnemonic] = useState<string | null>(null);
    const [existingAddress, setExistingAddress] = useState<string | null>(null);

    // Load existing wallet from localStorage on mount
    useEffect(() => {
        const loadWallet = async () => {
            const storedMnemonic = getCosmosMnemonic();
            let storedAddress = getCosmosAddress();


            // If we have a mnemonic but no address, derive and store the address
            if (storedMnemonic && !storedAddress) {
                try {
                    storedAddress = await getAddressFromMnemonic(storedMnemonic, "b52");
                    setCosmosAddress(storedAddress);
                } catch (err) {
                    console.error("❌ Failed to derive address:", err);
                }
            }

            setExistingMnemonic(storedMnemonic);
            setExistingAddress(storedAddress);
            setIsLoading(false);
        };

        loadWallet();
    }, []);

    // Generate new wallet
    const generateWalletHandler = async () => {
        try {
            setIsGenerating(true);
            setError("");

            // Generate a new 24-word mnemonic using SDK (proper BIP39 + bech32)
            const walletInfo = await generateWalletSDK("b52", 24);

            const newMnemonic = walletInfo.mnemonic;
            const newAddress = walletInfo.address;

            // Save to browser storage
            setCosmosMnemonic(newMnemonic);
            setCosmosAddress(newAddress);

            // Update local state for newly generated wallet display
            setMnemonic(newMnemonic);
            setAddress(newAddress);
            setShowMnemonic(true);

            // Update existing wallet state so UI shows "Current Wallet" section
            setExistingMnemonic(newMnemonic);
            setExistingAddress(newAddress);

        } catch (err) {
            console.error("Failed to generate wallet:", err);
            setError("Failed to generate wallet. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Import existing wallet
    const handleImportWallet = async () => {
        try {
            setIsGenerating(true);
            setError("");

            // Validate mnemonic
            if (!isValidSeedPhrase(importMnemonic)) {
                setError("Invalid seed phrase. Must be 12, 15, 18, 21, or 24 words.");
                return;
            }

            // Create wallet from mnemonic using SDK (proper BIP39 + bech32)
            const walletInfo = await createWalletSDK(importMnemonic, "b52");

            const importedAddress = walletInfo.address;

            // Save to browser storage
            setCosmosMnemonic(importMnemonic);
            setCosmosAddress(importedAddress);

            // Update local state
            setMnemonic(importMnemonic);
            setAddress(importedAddress);
            setImportMnemonic("");

            // Update existing wallet state so UI shows "Current Wallet" section
            setExistingMnemonic(importMnemonic);
            setExistingAddress(importedAddress);

        } catch (err) {
            console.error("Failed to import wallet:", err);
            setError("Failed to import wallet. Please check your seed phrase.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Clear wallet
    const handleClearWallet = () => {
        if (window.confirm("Are you sure you want to clear your wallet? Make sure you have saved your seed phrase!")) {
            clearCosmosData();
            setMnemonic("");
            setAddress("");
            setShowMnemonic(false);
            // Update state to show generate/import UI
            setExistingMnemonic(null);
            setExistingAddress(null);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        alert(`${label} copied to clipboard!`);
    };

    // Show loading state while checking localStorage
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden p-8 pt-24 pb-24">
                <AnimatedBackground />
                <div className="relative z-10 w-full max-w-xl mx-auto text-center">
                    <div className="animate-pulse">
                        <div className={`w-12 h-12 mx-auto mb-4 rounded-full ${styles.loadingDot}`}></div>
                        <p className="text-white">Loading wallet...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden p-8 pt-24 pb-24">
            {/* Animated background (same as other pages) */}
            <AnimatedBackground />

            {/* Content */}
            <div className="relative z-10 w-full max-w-xl mx-auto mb-6">
                <h1 className="text-3xl font-bold text-white mb-2 text-center">Block52 Wallet Manager</h1>
                <p className={`text-center mb-6 text-sm ${styles.textSecondary}`}>
                    Generate or import a wallet to receive deposits and play poker
                </p>
            </div>

            <div className="relative z-10 w-full max-w-xl mx-auto">
                {/* Existing Wallet Display */}
                {existingAddress && (
                    <div
                        className={`backdrop-blur-sm rounded-xl p-5 mb-4 border shadow-lg ${styles.mainCard}`}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">Current Wallet</h2>
                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm ${styles.textSecondary}`}>Address</label>
                                <div className="flex gap-2 items-center mt-1">
                                    <input
                                        type="text"
                                        value={existingAddress}
                                        readOnly
                                        className={`flex-1 text-white px-4 py-2 rounded-lg border font-mono text-sm ${styles.inputField}`}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(existingAddress, "Address")}
                                        className={`text-white px-4 py-2 rounded-lg transition-all hover:opacity-80 ${styles.primaryButton}`}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            {existingMnemonic && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`text-sm ${styles.textSecondary}`}>Seed Phrase</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowMnemonic(!showMnemonic)}
                                                className={`text-white px-3 py-1 rounded-lg transition-all hover:opacity-80 text-sm ${styles.secondaryButton}`}
                                            >
                                                {showMnemonic ? "Hide" : "Show"}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(existingMnemonic, "Seed Phrase")}
                                                className={`text-white px-3 py-1 rounded-lg transition-all hover:opacity-80 text-sm ${styles.primaryButton}`}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    <SeedPhraseGrid mnemonic={existingMnemonic} hidden={!showMnemonic} />
                                </div>
                            )}

                            <div className="flex flex-col space-y-3 mt-4">
                                <button
                                    onClick={() => navigate("/")}
                                    className={`w-full text-white px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-80 ${styles.primaryButton}`}
                                >
                                    Return to Dashboard
                                </button>
                                <button
                                    onClick={handleClearWallet}
                                    className={`w-full text-white px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-80 ${styles.dangerButton}`}
                                >
                                    Clear Wallet
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Generate New Wallet */}
                {!existingAddress && (
                    <div
                        className={`backdrop-blur-sm rounded-xl p-5 mb-4 border shadow-lg ${styles.mainCard}`}
                    >
                        <h2 className="text-xl font-bold text-white mb-3">Generate New Wallet</h2>
                        <p className={`mb-4 text-sm ${styles.textSecondary}`}>
                            Create a new Block52 wallet with a 24-word seed phrase. This will be saved in your browser.
                        </p>

                        <button
                            onClick={generateWalletHandler}
                            disabled={isGenerating}
                            className={`w-full text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-80 ${styles.primaryButton}`}
                        >
                            {isGenerating ? "Generating..." : "Generate New Wallet"}
                        </button>

                        {mnemonic && (
                            <div className="mt-6 space-y-4">
                                <div
                                    className={`rounded-xl p-4 ${styles.warningCard}`}
                                >
                                    <p className={`font-semibold ${styles.warningText}`}>⚠️ Important!</p>
                                    <p className={`text-sm mt-2 ${styles.warningTextMuted}`}>
                                        Write down your seed phrase and store it safely. This is the only way to recover your wallet.
                                    </p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`text-sm ${styles.textSecondary}`}>Your Seed Phrase</label>
                                        <button
                                            onClick={() => copyToClipboard(mnemonic, "Seed Phrase")}
                                            className={`text-white px-3 py-1 rounded-lg transition-all hover:opacity-80 text-sm ${styles.primaryButton}`}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <SeedPhraseGrid mnemonic={mnemonic} />
                                </div>

                                <div>
                                    <label className={`text-sm ${styles.textSecondary}`}>Your Address</label>
                                    <input
                                        type="text"
                                        value={address}
                                        readOnly
                                        className={`w-full text-white px-4 py-2 rounded-lg border font-mono text-sm mt-1 ${styles.inputField}`}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(address, "Address")}
                                        className={`mt-2 text-white px-4 py-2 rounded-lg transition-all hover:opacity-80 ${styles.primaryButton}`}
                                    >
                                        Copy Address
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Import Existing Wallet */}
                {!existingAddress && (
                    <div
                        className={`backdrop-blur-sm rounded-xl p-5 border shadow-lg ${styles.mainCard}`}
                    >
                        <h2 className="text-xl font-bold text-white mb-3">Import Existing Wallet</h2>
                        <p className={`mb-4 text-sm ${styles.textSecondary}`}>
                            Import an existing wallet using your 12 or 24-word seed phrase.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm ${styles.textSecondary}`}>Seed Phrase</label>
                                <textarea
                                    value={importMnemonic}
                                    onChange={e => setImportMnemonic(e.target.value)}
                                    placeholder="Enter your seed phrase (12 or 24 words)"
                                    rows={3}
                                    className={`w-full text-white px-4 py-3 rounded-lg border font-mono text-sm mt-1 placeholder-gray-500 ${styles.inputField}`}
                                />
                            </div>

                            <button
                                onClick={handleImportWallet}
                                disabled={isGenerating || !importMnemonic.trim()}
                                className={`w-full text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-80 ${styles.primaryButton}`}
                            >
                                {isGenerating ? "Importing..." : "Import Wallet"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Web3 Wallet Panel */}
                <div
                    className={`backdrop-blur-sm rounded-xl p-5 mt-4 border shadow-lg ${styles.mainCard}`}
                >
                    <h2 className="text-xl font-bold text-white mb-4">Web3 Wallet</h2>
                    {isWeb3Connected && web3Address ? (
                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm ${styles.textSecondary}`}>Connected Address</label>
                                <div className="flex gap-2 items-center mt-1">
                                    <input
                                        type="text"
                                        value={web3Address}
                                        readOnly
                                        className={`flex-1 text-white px-4 py-2 rounded-lg border font-mono text-sm ${styles.inputField}`}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(web3Address, "Web3 Address")}
                                        className={`text-white px-4 py-2 rounded-lg transition-all hover:opacity-80 ${styles.primaryButton}`}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => disconnectWeb3()}
                                className={`w-full text-white px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-80 ${styles.dangerButton}`}
                            >
                                Disconnect Web3 Wallet
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className={`mb-4 text-sm ${styles.textSecondary}`}>
                                Connect your Web3 wallet for deposits and withdrawals.
                            </p>
                            <button
                                onClick={() => openWeb3Wallet()}
                                className={`w-full text-white px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-80 ${styles.primaryButton}`}
                            >
                                Connect Your Web3 Wallet
                            </button>
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div
                        className={`mt-6 rounded-xl p-4 ${styles.errorCard}`}
                    >
                        <p className={styles.errorText}>{error}</p>
                    </div>
                )}
            </div>

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-20 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                </div>
            </div>
        </div>
    );
};

export default CosmosWalletPage;
