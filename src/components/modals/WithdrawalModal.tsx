import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import useCosmosWallet from "../../hooks/wallet/useCosmosWallet";
import { microToUsdc, usdcToMicroBigInt, formatMicroAsUsdc } from "../../constants/currency";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import { useNetwork } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";
import { base64ToHex } from "../../utils/encodingUtils";
import { useWithdraw } from "../../hooks/wallet/useWithdraw";
import styles from "./WithdrawalModal.module.css";

// ethers is still used for address validation in handleWithdraw

/**
 * WithdrawalModal Component
 *
 * Handles the complete 2-step withdrawal flow:
 *   Step 1 (Cosmos): Initiate withdrawal signed by cosmos key with eth address in message.
 *          The validator then signs the withdrawal payload for the deposit contract.
 *   Step 2 (Ethereum): User calls the deposit contract withdraw() via Web3 wallet.
 *
 * The modal auto-polls for the validator signature after initiation so the user
 * never has to leave or manually refresh.
 */

import type { WithdrawalModalProps } from "./types";

type ModalStep = "input" | "initiating" | "waiting_signature" | "ready_to_complete" | "completing_eth" | "done";

interface WithdrawalInfo {
    nonce: string;
    baseAddress: string;
    amount: string;
    signature: string;
}

const POLL_INTERVAL_MS = 3000;
const SLOW_POLL_THRESHOLD = 20; // ~60 seconds

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { balance: cosmosBalance, address: cosmosAddress, refreshBalance: refetchAccount } = useCosmosWallet();
    const { address: web3Address, isConnected: isWeb3Connected, open: openWalletConnect } = useUserWalletConnect();
    const { currentNetwork } = useNetwork();
    const { withdraw, hash: withdrawHash, isWithdrawConfirmed, withdrawError } = useWithdraw();

    const balanceInUSDC = useMemo(() => {
        const usdcBalanceEntry = cosmosBalance.find(b => b.denom === "usdc");
        return usdcBalanceEntry ? microToUsdc(usdcBalanceEntry.amount) : 0;
    }, [cosmosBalance]);

    // Form state
    const [amount, setAmount] = useState("");

    // Flow state
    const [step, setStep] = useState<ModalStep>("input");
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const [ethTxHash, setEthTxHash] = useState("");
    const [withdrawalInfo, setWithdrawalInfo] = useState<WithdrawalInfo | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Track the micro amount we initiated so we can match it during polling
    const initiatedAmountRef = useRef<string>("");

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, []);

    // Reset form when modal opens; cleanup polling when it closes.
    // setState in effect is intentional — standard modal reset pattern
    // where isOpen is controlled by the parent and there is no onOpen callback.
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAmount("");
            setError("");
            setStep("input");
            setTxHash("");
            setEthTxHash("");
            setWithdrawalInfo(null);
            setPollCount(0);
            initiatedAmountRef.current = "";
            refetchAccount();
        } else {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }
    }, [isOpen, refetchAccount]);

    const validateAmount = (value: string): boolean => {
        if (!value || isNaN(Number(value)) || Number(value) <= 0) return false;
        if (Number(value) < 0.01) return false;
        return Number(value) <= balanceInUSDC;
    };

    // Poll for validator signature after initiation
    const startPolling = useCallback(
        (targetAmount: string, targetBaseAddress: string) => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }

            const poll = async () => {
                try {
                    const { signingClient } = await getSigningClient(currentNetwork);
                    const withdrawals = await signingClient.listWithdrawalRequests(cosmosAddress!);

                    // Find matching withdrawal: same base address & amount, prefer signed
                    // Order by created_at desc to get the most recent if multiple match (should be rare)
                    const matching = withdrawals
                        .filter((w: any) => w.base_address?.toLowerCase() === targetBaseAddress.toLowerCase() && w.amount === targetAmount)
                        .sort((a: any, b: any) => {
                            if (a.status === "signed" && b.status !== "signed") return -1;
                            if (b.status === "signed" && a.status !== "signed") return 1;
                            return (b.created_at ?? 0) - (a.created_at ?? 0);
                        });

                    const found = matching[0];

                    if (found && found.status === "signed" && found.signature) {
                        // Validator has signed - stop polling
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                        setWithdrawalInfo({
                            nonce: found.nonce,
                            baseAddress: found.base_address,
                            amount: found.amount,
                            signature: found.signature
                        });
                        setStep("ready_to_complete");
                    } else {
                        setPollCount(prev => prev + 1);
                    }
                } catch (err) {
                    console.error("[WithdrawalModal] Polling error:", err);
                }
            };

            // Poll immediately, then on interval
            poll();
            pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
        },
        [currentNetwork, cosmosAddress]
    );

    // ─── Step 1: Initiate withdrawal on Cosmos ───────────────────────────
    const handleWithdraw = async () => {
        if (!isWeb3Connected || !web3Address) {
            setError("Please connect your Web3 wallet first");
            return;
        }

        if (!ethers.isAddress(web3Address)) {
            setError("Invalid Web3 wallet address");
            return;
        }

        if (!validateAmount(amount)) {
            setError(Number(amount) < 0.01 ? "Minimum withdrawal amount is 0.01 USDC" : "Invalid amount or insufficient balance");
            return;
        }

        setStep("initiating");
        setError("");

        try {
            const { signingClient } = await getSigningClient(currentNetwork);
            const microAmount = usdcToMicroBigInt(parseFloat(amount));
            initiatedAmountRef.current = microAmount.toString();

            // Send MsgInitiateWithdrawal signed by cosmos key, eth address in message
            const hash = await signingClient.initiateWithdrawal(web3Address, microAmount);

            setTxHash(hash);
            setStep("waiting_signature");

            // Start auto-polling for the validator signature
            startPolling(microAmount.toString(), web3Address);

            // Refresh cosmos balance in the background
            setTimeout(() => refetchAccount(), 2000);
        } catch (err: any) {
            console.error("[WithdrawalModal] Withdrawal error:", err);

            if (err.message?.includes("insufficient")) {
                setError("Insufficient balance for withdrawal");
            } else if (err.message?.includes("network")) {
                setError("Network error. Please try again");
            } else if (err.message?.includes("rejected")) {
                setError("Transaction rejected by user");
            } else {
                setError(err.message || "Failed to initiate withdrawal");
            }
            setStep("input");
        }
    };

    // ─── Step 2: Complete withdrawal on Ethereum ─────────────────────────
    const handleCompleteOnEthereum = async () => {
        if (!withdrawalInfo) {
            setError("No withdrawal signature available");
            return;
        }

        if (!isWeb3Connected || !web3Address) {
            setError("Please connect your Web3 wallet");
            return;
        }

        setStep("completing_eth");
        setError("");

        try {
            const hexSignature = base64ToHex(withdrawalInfo.signature);

            // Use the useWithdraw hook which properly uses wagmi/reown wallet
            await withdraw(withdrawalInfo.nonce, withdrawalInfo.baseAddress, BigInt(withdrawalInfo.amount), hexSignature);

            // The hook will trigger isWithdrawConfirmed when done
        } catch (err: any) {
            console.error("[WithdrawalModal] Ethereum tx error:", err);
            setError(err.message || "Failed to complete withdrawal on Ethereum");
            setStep("ready_to_complete");
        }
    };

    // Handle withdrawal confirmation via useWithdraw hook
    useEffect(() => {
        if (isWithdrawConfirmed && step === "completing_eth") {
            setEthTxHash(withdrawHash || "");
            setStep("done");
            if (onSuccess) onSuccess();
        }
    }, [isWithdrawConfirmed, withdrawHash, step, onSuccess]);

    // Handle withdrawal errors
    useEffect(() => {
        if (withdrawError && step === "completing_eth") {
            console.error("[WithdrawalModal] Withdrawal error:", withdrawError);
            setError(withdrawError.message || "Failed to complete withdrawal on Ethereum");
            setStep("ready_to_complete");
        }
    }, [withdrawError, step]);

    if (!isOpen) return null;

    const balanceDisplay = balanceInUSDC.toFixed(2);

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${styles.overlay}`}>
            <div className={`rounded-xl p-6 w-full max-w-md mx-4 ${styles.modalContainer}`}>
                <h2 className="text-2xl font-bold mb-4 text-white">Withdraw Funds</h2>

                {/* Step indicator */}
                <div className="mb-4 flex items-center justify-center gap-2">
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            step === "input" || step === "initiating" || step === "waiting_signature" ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                        }`}
                    >
                        1
                    </div>
                    <div
                        className={`w-12 h-0.5 ${
                            step === "ready_to_complete" || step === "completing_eth" || step === "done" ? "bg-green-600" : "bg-gray-600"
                        }`}
                    />
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            step === "ready_to_complete" || step === "completing_eth"
                                ? "bg-blue-600 text-white"
                                : step === "done"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-600 text-gray-400"
                        }`}
                    >
                        2
                    </div>
                </div>
                <div className="mb-4 flex justify-between text-xs text-gray-400 px-2">
                    <span>Block52 Chain</span>
                    <span>Ethereum</span>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mb-4 p-3 rounded-lg ${styles.dangerAlert}`}>
                        <p className={styles.textDanger}>{error}</p>
                    </div>
                )}

                {/* ─── STEP: Input ─────────────────────────────────────── */}
                {step === "input" && (
                    <>
                        <div className={`mb-4 p-3 rounded-lg ${styles.surfaceMuted}`}>
                            <p className={`text-sm ${styles.textSecondary}`}>Available Balance</p>
                            <p className={`text-xl font-bold ${styles.textPrimary}`}>${balanceDisplay} USDC</p>
                        </div>

                        {!isWeb3Connected || !web3Address ? (
                            <div className="mb-4">
                                <p className={`text-sm mb-3 ${styles.textSecondary}`}>
                                    Connect your Web3 wallet to withdraw funds. The withdrawal will be sent to your connected wallet address.
                                </p>
                                <button
                                    onClick={() => openWalletConnect()}
                                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition hover:opacity-90 ${styles.primaryActionButton}`}
                                >
                                    Connect Your Web3 Wallet
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <label className={`block text-sm mb-2 ${styles.textSecondary}`}>Withdrawal Address</label>
                                <div className={`p-3 rounded-lg ${styles.surfacePrimarySoft}`}>
                                    <p className={`font-mono text-sm ${styles.textPrimary}`}>{web3Address}</p>
                                </div>
                                <p className="text-xs mt-1 text-gray-500">Funds will be sent to your connected Web3 wallet</p>
                            </div>
                        )}

                        {isWeb3Connected && web3Address && (
                            <div className="mb-6">
                                <label className={`block text-sm mb-2 ${styles.textSecondary}`}>Amount (USDC)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    max={balanceInUSDC}
                                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 ${styles.amountInput}`}
                                />
                                <p className="text-xs text-gray-500 mt-1">Minimum: 0.01 USDC</p>
                            </div>
                        )}

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleWithdraw}
                                className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-50 ${styles.primaryActionButton}`}
                                disabled={!isWeb3Connected || !web3Address || !amount}
                            >
                                Withdraw
                            </button>
                            <button
                                onClick={onClose}
                                className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition hover:opacity-80 ${styles.cancelActionButton}`}
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}

                {/* ─── STEP: Initiating cosmos tx ──────────────────────── */}
                {step === "initiating" && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-white font-semibold mb-2">Initiating Withdrawal</p>
                        <p className="text-gray-400 text-sm">Signing withdrawal request on Block52 chain...</p>
                    </div>
                )}

                {/* ─── STEP: Waiting for validator signature ───────────── */}
                {step === "waiting_signature" && (
                    <div className="text-center py-6">
                        <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-white font-semibold mb-2">Waiting for Validator Signature</p>
                        <p className="text-gray-400 text-sm mb-4">
                            Your withdrawal request has been submitted. The validator is signing the withdrawal payload for the deposit contract...
                        </p>
                        {txHash && <p className="text-gray-500 text-xs font-mono mb-2">Cosmos Tx: {txHash.slice(0, 16)}...</p>}
                        <p className="text-gray-600 text-xs">
                            Checking... ({pollCount} {pollCount === 1 ? "attempt" : "attempts"})
                        </p>

                        {pollCount > SLOW_POLL_THRESHOLD && (
                            <div className={`mt-4 p-3 rounded-lg text-left ${styles.warningAlert}`}>
                                <p className={`text-sm ${styles.textWarning}`}>
                                    Signing is taking longer than expected. The validator may need additional time. You can wait here or check the Withdrawal
                                    Dashboard later.
                                </p>
                            </div>
                        )}

                        <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition">
                            Close (withdrawal will continue in background)
                        </button>
                    </div>
                )}

                {/* ─── STEP: Ready to complete on Ethereum ─────────────── */}
                {step === "ready_to_complete" && withdrawalInfo && (
                    <div className="py-4">
                        <div className={`mb-4 p-3 rounded-lg ${styles.successAlert}`}>
                            <p className={`font-semibold ${styles.textSuccess}`}>Validator Signature Received</p>
                            <p className={`text-sm mt-1 ${styles.textSecondary}`}>Your withdrawal is signed and ready to complete on Ethereum.</p>
                        </div>

                        <div className={`mb-4 p-3 rounded-lg ${styles.surfaceMuted}`}>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Amount:</span>
                                    <span className="text-white font-semibold">{formatMicroAsUsdc(withdrawalInfo.amount, 6)} USDC</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">To:</span>
                                    <span className="text-white font-mono text-xs">
                                        {withdrawalInfo.baseAddress.slice(0, 10)}...
                                        {withdrawalInfo.baseAddress.slice(-8)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleCompleteOnEthereum}
                                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition hover:opacity-90 ${styles.primaryActionButton}`}
                            >
                                Complete on Ethereum
                            </button>
                            <p className="text-center text-sm text-gray-400">You can complete this withdrawal later from the Withdrawal Dashboard</p>
                            <button
                                onClick={onClose}
                                className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition hover:opacity-80 ${styles.cancelActionButton}`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STEP: Completing on Ethereum ────────────────────── */}
                {step === "completing_eth" && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-white font-semibold mb-2">Completing on Ethereum</p>
                        <p className="text-gray-400 text-sm">Confirm the transaction in your wallet...</p>
                    </div>
                )}

                {/* ─── STEP: Done ──────────────────────────────────────── */}
                {step === "done" && (
                    <div className="py-4">
                        <div className={`mb-4 p-4 rounded-lg ${styles.successAlert}`}>
                            <p className={`text-lg font-bold ${styles.textSuccess}`}>Withdrawal Complete!</p>
                            <p className={`text-sm mt-2 ${styles.textSecondary}`}>USDC has been transferred to your Ethereum wallet.</p>
                            {ethTxHash && <p className="text-xs mt-2 font-mono text-gray-500">Eth Tx: {ethTxHash.slice(0, 16)}...</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition hover:opacity-90 ${styles.primaryActionButton}`}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawalModal;
