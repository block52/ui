import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateWallet as generateWalletSDK, createWalletFromMnemonic as createWalletSDK, getAddressFromMnemonic } from "@block52/poker-vm-sdk";
import { setCosmosMnemonic, setCosmosAddress, getCosmosMnemonic, getCosmosAddress, clearCosmosData, isValidSeedPhrase } from "../utils/cosmos";
import { clearCosmosClient } from "../utils/cosmos/client";
import { Card, PillButton } from "./ui";
import { fieldLabelClass, insetBoxClass, noticeClass } from "./modals/walletFormClasses";
import { CopyIcon, WarningIcon } from "./modals/walletIcons";
import useUserWalletConnect from "../hooks/wallet/useUserWalletConnect";
import { toast } from "react-toastify";
import { ConfirmDialog } from "./modals/ConfirmDialog";

// Seed phrase word grid: numbered chips on surface-raised
const SeedPhraseGrid = ({ mnemonic, hidden = false }: { mnemonic: string; hidden?: boolean }) => {
    const words = mnemonic.split(" ");
    return (
        <ol className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 gap-2">
            {words.map((word, index) => (
                <li key={index} className="flex items-center gap-2 px-3 h-11 rounded-xl bg-surface-raised border border-line font-mono text-sm">
                    <span className="w-6 text-xs text-ink-muted tabular-nums">{index + 1}</span>
                    <span className="text-ink truncate">{hidden ? "••••" : word}</span>
                </li>
            ))}
        </ol>
    );
};

/** Read-only value with a copy icon button. */
const CopyField = ({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) => (
    <div>
        <span className={fieldLabelClass}>{label}</span>
        <div className={`flex items-center gap-2 pr-1.5 ${insetBoxClass}`}>
            <p className="flex-1 min-w-0 m-0 font-mono text-sm text-ink break-all">{value}</p>
            <button
                type="button"
                onClick={onCopy}
                aria-label={`Copy ${label.toLowerCase()}`}
                className="shrink-0 w-11 h-11 grid place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            >
                <CopyIcon />
            </button>
        </div>
    </div>
);

const SectionHeading = ({ title, text }: { title: string; text?: string }) => (
    <div className="mb-4">
        <h2 className="m-0 text-[17px] font-semibold text-ink">{title}</h2>
        {text && <p className="m-0 mt-1 text-sm text-ink-muted">{text}</p>}
    </div>
);

const CosmosWalletPage = () => {
    const navigate = useNavigate();
    const { open: openWeb3Wallet, disconnect: disconnectWeb3, isConnected: isWeb3Connected, address: web3Address } = useUserWalletConnect();
    const [mnemonic, setMnemonic] = useState<string>("");
    const [address, setAddress] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
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

    // Clear wallet: asks first (ConfirmDialog), clears once confirmed
    const handleClearWallet = () => setShowClearConfirm(true);

    const confirmClearWallet = () => {
        setShowClearConfirm(false);
        clearCosmosData();
        // Drop both cached clients so derived keys don't outlive the wallet.
        clearCosmosClient();
        setMnemonic("");
        setAddress("");
        setShowMnemonic(false);
        // Update state to show generate/import UI
        setExistingMnemonic(null);
        setExistingAddress(null);
    };

    // Copy to clipboard
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    // Show loading state while checking localStorage
    if (isLoading) {
        return (
            <div className="min-h-screen bg-surface-page grid place-items-center p-8">
                <p role="status" className="text-ink-muted animate-pulse">
                    Loading wallet...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-page text-ink-body px-4 sm:px-8 py-8 pb-24">
            <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
                <div className="mb-2">
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Block52 Wallet Manager</h1>
                    <p className="m-0 mt-1 text-sm text-ink-muted">Generate or import a wallet to receive deposits and play poker</p>
                </div>

                {/* Existing Wallet Display */}
                {existingAddress && (
                    <Card className="p-5 sm:p-6">
                        <SectionHeading title="Current Wallet" />
                        <div className="space-y-4">
                            <CopyField label="Address" value={existingAddress} onCopy={() => copyToClipboard(existingAddress, "Address")} />

                            {existingMnemonic && (
                                <div>
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                        <span className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Seed phrase</span>
                                        <div className="flex gap-2">
                                            <PillButton variant="outline" size="sm" onClick={() => setShowMnemonic(!showMnemonic)}>
                                                {showMnemonic ? "Hide" : "Show"}
                                            </PillButton>
                                            <PillButton variant="outline" size="sm" onClick={() => copyToClipboard(existingMnemonic, "Seed Phrase")}>
                                                Copy
                                            </PillButton>
                                        </div>
                                    </div>
                                    <SeedPhraseGrid mnemonic={existingMnemonic} hidden={!showMnemonic} />
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-2">
                                <PillButton size="lg" className="w-full" onClick={() => navigate("/")}>
                                    Return to Dashboard
                                </PillButton>
                                <PillButton
                                    variant="ghost"
                                    size="lg"
                                    className="w-full hover:!text-red-400"
                                    onClick={handleClearWallet}
                                >
                                    Clear Wallet
                                </PillButton>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Generate New Wallet */}
                {!existingAddress && (
                    <Card className="p-5 sm:p-6">
                        <SectionHeading title="Generate New Wallet" text="Create a new Block52 wallet with a 24-word seed phrase. This will be saved in your browser." />

                        <PillButton size="lg" className="w-full" onClick={generateWalletHandler} disabled={isGenerating}>
                            {isGenerating ? "Generating..." : "Generate New Wallet"}
                        </PillButton>

                        {mnemonic && (
                            <div className="mt-6 space-y-4">
                                <div role="alert" className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                    <WarningIcon className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="m-0 font-semibold">Important</p>
                                        <p className="m-0 mt-1 text-sm text-amber-300/80">
                                            Write down your seed phrase and store it safely. This is the only way to recover your wallet.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                        <span className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Your seed phrase</span>
                                        <PillButton variant="outline" size="sm" onClick={() => copyToClipboard(mnemonic, "Seed Phrase")}>
                                            Copy
                                        </PillButton>
                                    </div>
                                    <SeedPhraseGrid mnemonic={mnemonic} />
                                </div>

                                <CopyField label="Your address" value={address} onCopy={() => copyToClipboard(address, "Address")} />
                            </div>
                        )}
                    </Card>
                )}

                {/* Import Existing Wallet */}
                {!existingAddress && (
                    <Card className="p-5 sm:p-6">
                        <SectionHeading title="Import Existing Wallet" text="Import an existing wallet using your 12 or 24-word seed phrase." />

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="import-seed" className={fieldLabelClass}>
                                    Seed phrase
                                </label>
                                <textarea
                                    id="import-seed"
                                    value={importMnemonic}
                                    onChange={e => setImportMnemonic(e.target.value)}
                                    placeholder="Enter your seed phrase (12 or 24 words)"
                                    rows={3}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-line text-ink font-mono text-sm placeholder:text-ink-muted/70 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
                                />
                            </div>

                            <PillButton size="lg" className="w-full" onClick={handleImportWallet} disabled={isGenerating || !importMnemonic.trim()}>
                                {isGenerating ? "Importing..." : "Import Wallet"}
                            </PillButton>
                        </div>
                    </Card>
                )}

                {/* Web3 Wallet Panel */}
                <Card className="p-5 sm:p-6">
                    <SectionHeading title="Web3 Wallet" text={isWeb3Connected && web3Address ? undefined : "Connect your Web3 wallet for deposits and withdrawals."} />
                    {isWeb3Connected && web3Address ? (
                        <div className="space-y-4">
                            <CopyField label="Connected address" value={web3Address} onCopy={() => copyToClipboard(web3Address, "Web3 Address")} />
                            <PillButton variant="outline" size="lg" className="w-full" onClick={() => disconnectWeb3()}>
                                Disconnect Web3 Wallet
                            </PillButton>
                        </div>
                    ) : (
                        <PillButton size="lg" className="w-full" onClick={() => openWeb3Wallet()}>
                            Connect Your Web3 Wallet
                        </PillButton>
                    )}
                </Card>

                {/* Error Display */}
                {error && (
                    <div role="alert" className={noticeClass.error}>
                        {error}
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={showClearConfirm}
                title="Clear your wallet?"
                message="This removes the wallet from this browser. Your funds stay on the chain, but only your seed phrase can bring the wallet back."
                warning="Make sure you have saved your seed phrase before you continue."
                confirmLabel="Clear wallet"
                tone="danger"
                onConfirm={confirmClearWallet}
                onCancel={() => setShowClearConfirm(false)}
            />
        </div>
    );
};

export default CosmosWalletPage;
