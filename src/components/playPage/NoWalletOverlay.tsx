import React, { useState, useCallback } from "react";
import { generateWallet as generateWalletSDK, createWalletFromMnemonic as createWalletSDK } from "@block52/poker-vm-sdk";
import { setCosmosMnemonic, setCosmosAddress, isValidSeedPhrase } from "../../utils/cosmos";
import { HexagonPattern } from "../common/Modal";
import styles from "./NoWalletOverlay.module.css";

type Step = "choose" | "seed-phrase" | "importing";

interface NoWalletOverlayProps {
    /** Called after a wallet is successfully saved to localStorage */
    onWalletReady: () => void;
}

const NoWalletOverlay: React.FC<NoWalletOverlayProps> = ({ onWalletReady }) => {
    const [step, setStep] = useState<Step>("choose");
    const [newMnemonic, setNewMnemonic] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [seedCopied, setSeedCopied] = useState(false);
    const [importPhrase, setImportPhrase] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    // ── Create ────────────────────────────────────────────────────────────────

    const handleCreate = useCallback(async () => {
        setIsBusy(true);
        setError("");
        try {
            const walletInfo = await generateWalletSDK("b52", 24);
            setNewMnemonic(walletInfo.mnemonic);
            setNewAddress(walletInfo.address);
            setStep("seed-phrase");
        } catch {
            setError("Failed to generate wallet. Please try again.");
        } finally {
            setIsBusy(false);
        }
    }, []);

    const handleConfirmSeedPhrase = useCallback(async () => {
        setIsBusy(true);
        setError("");
        try {
            setCosmosMnemonic(newMnemonic);
            setCosmosAddress(newAddress);
            onWalletReady();
        } catch {
            setError("Failed to save wallet. Please try again.");
        } finally {
            setIsBusy(false);
        }
    }, [newMnemonic, newAddress, onWalletReady]);

    const handleCopySeed = useCallback(() => {
        navigator.clipboard.writeText(newMnemonic);
        setSeedCopied(true);
    }, [newMnemonic]);

    // ── Import ────────────────────────────────────────────────────────────────

    const handleImport = useCallback(async () => {
        setError("");
        if (!isValidSeedPhrase(importPhrase.trim())) {
            setError("Invalid seed phrase. Must be 12, 15, 18, 21, or 24 words separated by spaces.");
            return;
        }
        setIsBusy(true);
        try {
            const walletInfo = await createWalletSDK(importPhrase.trim(), "b52");
            setCosmosMnemonic(importPhrase.trim());
            setCosmosAddress(walletInfo.address);
            onWalletReady();
        } catch {
            setError("Failed to import wallet. Please check your seed phrase.");
        } finally {
            setIsBusy(false);
        }
    }, [importPhrase, onWalletReady]);

    // ── Render ────────────────────────────────────────────────────────────────

    const words = newMnemonic ? newMnemonic.split(" ") : [];

    return (
        /* Blurred table backdrop */
        <div className="fixed inset-0 z-[2000] backdrop-blur-md bg-black/60 flex items-center justify-center px-4">
            <div className={`relative w-full max-w-md rounded-xl shadow-2xl p-6 space-y-5 overflow-hidden ${styles.modalContainer}`}>

                {/* Hexagon pattern background */}
                <HexagonPattern patternId="hexagons-nowallet" />

                {/* Decorative card suits */}
                <div className="absolute -right-8 -top-8 text-6xl opacity-10 rotate-12">♠</div>
                <div className="absolute -left-8 -bottom-8 text-6xl opacity-10 -rotate-12">♥</div>

                {/* ── Step: Choose ── */}
                {step === "choose" && (
                    <>
                        <div className="relative text-center space-y-1">
                            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                                <span className={styles.suitPrimary}>♣</span>
                                Game Wallet Required
                                <span className={styles.suitDanger}>♦</span>
                            </h2>
                            <div className={`w-full h-0.5 my-3 opacity-50 ${styles.dividerPrimary}`}></div>
                            <p className={`text-sm ${styles.textSecondary}`}>
                                You need a Block52 game wallet to play. Create one now or import an existing one.
                            </p>
                        </div>
                        <div className="relative space-y-3">
                            <button
                                onClick={handleCreate}
                                disabled={isBusy}
                                className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition-all ${styles.primaryButton}`}
                            >
                                {isBusy ? "Generating..." : "Create New Wallet"}
                            </button>
                            <button
                                onClick={() => setStep("importing")}
                                className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${styles.secondaryButton}`}
                            >
                                Import Existing Wallet
                            </button>
                        </div>
                        {error && <p className={`text-sm text-center relative ${styles.errorText}`}>{error}</p>}
                    </>
                )}

                {/* ── Step: Show seed phrase ── */}
                {step === "seed-phrase" && (
                    <>
                        <div className="relative text-center space-y-1">
                            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                                <span className={styles.suitPrimary}>♣</span>
                                Save Your Seed Phrase
                                <span className={styles.suitDanger}>♦</span>
                            </h2>
                            <div className={`w-full h-0.5 my-3 opacity-50 ${styles.dividerPrimary}`}></div>
                            <p className={`text-sm ${styles.textSecondary}`}>
                                Write these 24 words down in order and keep them safe. You cannot recover your wallet without them.
                            </p>
                        </div>

                        {/* Seed word grid */}
                        <div className="relative grid grid-cols-3 gap-2">
                            {words.map((word, i) => (
                                <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${styles.seedWordCard}`}>
                                    <span className={`text-xs w-4 shrink-0 ${styles.seedWordIndex}`}>{i + 1}.</span>
                                    <span className="text-white text-xs font-medium">{word}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleCopySeed}
                            className={`relative w-full py-2 rounded-lg text-sm font-medium transition-all ${styles.copyButton}`}
                        >
                            {seedCopied ? "✓ Copied!" : "Copy to Clipboard"}
                        </button>

                        <div className="relative space-y-2">
                            <button
                                onClick={handleConfirmSeedPhrase}
                                disabled={isBusy}
                                className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition-all ${styles.primaryButton}`}
                            >
                                {isBusy ? "Saving..." : "I've Saved My Seed Phrase — Continue"}
                            </button>
                            <button
                                onClick={() => setStep("choose")}
                                className={`w-full py-2 rounded-xl text-sm transition-all ${styles.ghostButton}`}
                            >
                                Back
                            </button>
                        </div>
                        {error && <p className={`text-sm text-center relative ${styles.errorText}`}>{error}</p>}
                    </>
                )}

                {/* ── Step: Import ── */}
                {step === "importing" && (
                    <>
                        <div className="relative text-center space-y-1">
                            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                                <span className={styles.suitPrimary}>♣</span>
                                Import Wallet
                                <span className={styles.suitDanger}>♦</span>
                            </h2>
                            <div className={`w-full h-0.5 my-3 opacity-50 ${styles.dividerPrimary}`}></div>
                            <p className={`text-sm ${styles.textSecondary}`}>
                                Enter your 12 or 24-word seed phrase to restore your wallet.
                            </p>
                        </div>

                        <textarea
                            value={importPhrase}
                            onChange={e => setImportPhrase(e.target.value)}
                            placeholder="word1 word2 word3 ..."
                            rows={4}
                            className={`relative w-full p-3 rounded-lg font-mono text-sm placeholder-gray-500 resize-none ${styles.inputField}`}
                        />

                        {error && <p className={`text-sm relative ${styles.errorText}`}>{error}</p>}

                        <div className="relative space-y-2">
                            <button
                                onClick={handleImport}
                                disabled={isBusy || !importPhrase.trim()}
                                className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition-all ${styles.primaryButton}`}
                            >
                                {isBusy ? "Importing..." : "Import Wallet"}
                            </button>
                            <button
                                onClick={() => { setStep("choose"); setError(""); }}
                                className={`w-full py-2 rounded-xl text-sm transition-all ${styles.ghostButton}`}
                            >
                                Back
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default NoWalletOverlay;
