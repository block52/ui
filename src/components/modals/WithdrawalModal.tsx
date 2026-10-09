import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import useCosmosWallet from "../../hooks/wallet/useCosmosWallet";
import { microToUsdc, usdcToMicroBigInt, formatMicroAsUsdc, parseUsdcToMicro } from "../../constants/currency";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import { useNetwork } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";
import { base64ToHex } from "../../utils/encodingUtils";
import { useWithdrawalSignature } from "../../hooks/wallet/useWithdrawalSignature";
import { describeWithdrawError } from "../../utils/withdrawalSignature";
import { useWithdraw } from "../../hooks/wallet/useWithdraw";
import { Modal } from "../common/Modal";
import { PillButton } from "../ui";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { amountInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "./walletFormClasses";
import { ModalFooter } from "./ModalFooter";
import { AmountPresets, type AmountPreset } from "./AmountPresets";
import { CheckIcon, CopyIcon, SpinnerRing } from "./walletIcons";

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
    /** 0x-hex validator signature, ready for CosmosBridge.withdraw(). */
    signature: string;
}

const POLL_INTERVAL_MS = 3000;
const SLOW_POLL_THRESHOLD = 20; // ~60 seconds

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { balance: cosmosBalance, address: cosmosAddress, refreshBalance: refetchAccount } = useCosmosWallet();
    const { address: web3Address, isConnected: isWeb3Connected, open: openWalletConnect } = useUserWalletConnect();
    const { currentNetwork } = useNetwork();
    const { withdraw, hash: withdrawHash, isWithdrawConfirmed, withdrawError } = useWithdraw();
    const fetchWithdrawalSignature = useWithdrawalSignature();
    const { copy, copied } = useCopyToClipboard();

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

                    // Prefer a validator's on-demand signature: the one stored on chain can be overwritten with one the bridge rejects.
                    let signature: string | null = null;
                    if (found) {
                        signature = await fetchWithdrawalSignature({ nonce: found.nonce, baseAddress: found.base_address, amount: found.amount }).catch(
                            (err: unknown) => {
                                console.error("[WithdrawalModal] Validator signature not available yet:", err);
                                return found.status === "signed" && found.signature ? base64ToHex(found.signature) : null;
                            }
                        );
                    }

                    if (found && signature) {
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                        setWithdrawalInfo({
                            nonce: found.nonce,
                            baseAddress: found.base_address,
                            amount: found.amount,
                            signature
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
        [currentNetwork, cosmosAddress, fetchWithdrawalSignature]
    );

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
            const microAmount = parseUsdcToMicro(amount);
            initiatedAmountRef.current = microAmount.toString();

            // Send MsgInitiateWithdrawal signed by cosmos key, eth address in message
            const hash = await signingClient.initiateWithdrawal(web3Address, microAmount);

            setTxHash(hash);
            setStep("waiting_signature");

            // Start auto-polling for the validator signature
            startPolling(microAmount.toString(), web3Address);

            // Refresh cosmos balance in the background
            setTimeout(() => refetchAccount(), 2000);
        } catch (err) {
            console.error("[WithdrawalModal] Withdrawal error:", err);
            const message = err instanceof Error ? err.message : "";

            if (message.includes("insufficient")) {
                setError("Insufficient balance for withdrawal");
            } else if (message.includes("network")) {
                setError("Network error. Please try again");
            } else if (message.includes("rejected")) {
                setError("Transaction rejected by user");
            } else {
                setError(message || "Failed to initiate withdrawal");
            }
            setStep("input");
        }
    };

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
            // Use the useWithdraw hook which properly uses wagmi/reown wallet
            await withdraw(withdrawalInfo.nonce, withdrawalInfo.baseAddress, BigInt(withdrawalInfo.amount), withdrawalInfo.signature);

            // The hook will trigger isWithdrawConfirmed when done
        } catch (err) {
            console.error("[WithdrawalModal] Ethereum tx error:", err);
            setError(describeWithdrawError(err));
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
            setError(describeWithdrawError(withdrawError));
            setStep("ready_to_complete");
        }
    }, [withdrawError, step]);

    if (!isOpen) return null;

    const balanceDisplay = balanceInUSDC.toFixed(2);
    const walletConnected = Boolean(isWeb3Connected && web3Address);

    // Quick amounts: rounded DOWN to whole cents so a preset never exceeds the balance.
    const presetValue = (fraction: number): string => (Math.floor(balanceInUSDC * fraction * 100 + 1e-9) / 100).toFixed(2);
    const presets: ReadonlyArray<AmountPreset> = [
        { label: "25%", value: presetValue(0.25) },
        { label: "50%", value: presetValue(0.5) },
        { label: "75%", value: presetValue(0.75) },
        { label: "Max", value: presetValue(1) }
    ];
    const amountEntered = amount !== "";
    const amountInvalid = amountEntered && !validateAmount(amount);
    const amountProblem = Number(amount) < 0.01 ? "Minimum withdrawal amount is 0.01 USDC" : "Invalid amount or insufficient balance";
    const canPickAmount = walletConnected && balanceInUSDC >= 0.01;

    const stepBadge = (done: boolean, active: boolean, label: string) => (
        <span
            className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                done ? "bg-emerald-500/15 text-emerald-400" : active ? "bg-brand text-white" : "bg-surface-hover text-ink-muted"
            }`}
        >
            {done ? <CheckIcon className="w-4 h-4" /> : label}
        </span>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Withdraw"
            subtitle="Move USDC from Block52 to Ethereum"
            widthClass="w-full max-w-[460px]"
            error={error || null}
            isProcessing={step === "initiating" || step === "completing_eth"}
            closeOnBackdropClick={false}
            closeOnEscape={false}
        >
            {step === "input" && (
                <>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-label="Withdrawal route">
                            <div className={`${insetBoxClass} min-w-0`}>
                                <p className="m-0 text-[11px] uppercase tracking-[0.08em] text-ink-muted">From</p>
                                <p className="m-0 mt-0.5 text-sm font-semibold text-ink truncate">Block52 chain</p>
                            </div>
                            <svg className="w-5 h-5 text-ink-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12m-4-4l4 4-4 4" />
                            </svg>
                            <div className={`${insetBoxClass} min-w-0`}>
                                <p className="m-0 text-[11px] uppercase tracking-[0.08em] text-ink-muted">To</p>
                                <p className="m-0 mt-0.5 text-sm font-semibold text-ink truncate">Ethereum</p>
                            </div>
                        </div>

                        <div className="text-center py-1">
                            <p className="m-0 text-xs uppercase tracking-[0.08em] text-ink-muted">Available</p>
                            <p className="m-0 mt-1 text-3xl font-bold tabular-nums text-ink">
                                ${balanceDisplay} <span className="text-sm font-medium text-ink-muted">USDC</span>
                            </p>
                        </div>

                        <section className={`p-4 rounded-2xl border ${walletConnected ? "border-line bg-surface-card" : "border-brand/40 bg-brand/5"}`} aria-label="Step 1">
                            <div className="flex items-center gap-3">
                                {stepBadge(walletConnected, !walletConnected, "1")}
                                <h3 className="m-0 text-sm font-semibold text-ink">Connect an Ethereum wallet</h3>
                            </div>
                            {!walletConnected || !web3Address ? (
                                <div className="mt-3 space-y-3">
                                    <p className="m-0 text-sm text-ink-soft">
                                        Connect your Web3 wallet to withdraw funds. The withdrawal will be sent to your connected wallet address.
                                    </p>
                                    <PillButton size="lg" className="w-full" onClick={() => openWalletConnect()}>
                                        Connect Your Web3 Wallet
                                    </PillButton>
                                </div>
                            ) : (
                                <div className="mt-3">
                                    <span className={fieldLabelClass}>Withdrawal address</span>
                                    <div className={`flex items-center gap-2 pr-1.5 ${insetBoxClass}`}>
                                        <span className="shrink-0 text-emerald-400" aria-hidden="true">
                                            <CheckIcon />
                                        </span>
                                        <p className="flex-1 min-w-0 m-0 font-mono text-sm text-ink break-all">{web3Address}</p>
                                        <button
                                            type="button"
                                            onClick={() => copy(web3Address, "Address copied to clipboard!")}
                                            aria-label={copied ? "Address copied" : "Copy withdrawal address"}
                                            className={`shrink-0 w-11 h-11 grid place-items-center rounded-btn transition-colors hover:bg-surface-hover ${copied ? "text-emerald-400" : "text-ink-muted hover:text-ink"}`}
                                        >
                                            {copied ? <CheckIcon /> : <CopyIcon />}
                                        </button>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                        <p className="m-0 text-xs text-ink-muted">Funds will be sent to your connected Web3 wallet</p>
                                        <PillButton variant="ghost" size="sm" className="shrink-0 h-11 sm:h-9" onClick={() => openWalletConnect()}>
                                            Change
                                        </PillButton>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section
                            className={`p-4 rounded-2xl border transition-opacity ${walletConnected ? "border-brand/40 bg-brand/5" : "border-line bg-surface-card opacity-60"}`}
                            aria-label="Step 2"
                            aria-disabled={!walletConnected}
                        >
                            <div className="flex items-center gap-3">
                                {stepBadge(false, walletConnected, "2")}
                                <h3 className="m-0 text-sm font-semibold text-ink">Choose an amount and confirm</h3>
                            </div>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <label htmlFor="withdraw-amount" className={fieldLabelClass}>
                                        Amount (USDC)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none" aria-hidden="true">
                                            $
                                        </span>
                                        <input
                                            id="withdraw-amount"
                                            type="number"
                                            inputMode="decimal"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0"
                                            max={balanceInUSDC}
                                            disabled={!walletConnected}
                                            autoFocus={walletConnected}
                                            aria-invalid={amountInvalid}
                                            aria-describedby="withdraw-amount-help"
                                            className={`${amountInputClass} pl-9 pr-28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed ${
                                                amountInvalid ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/30" : ""
                                            }`}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted pointer-events-none">USDC</span>
                                    </div>
                                    <p id="withdraw-amount-help" className={`m-0 mt-1.5 text-xs ${amountInvalid ? "text-red-400" : "text-ink-muted"}`}>
                                        {amountInvalid ? amountProblem : `Available $${balanceDisplay} · Minimum: 0.01 USDC`}
                                    </p>
                                </div>
                                <AmountPresets presets={presets} current={amount} onPick={setAmount} disabled={!canPickAmount} />
                            </div>
                        </section>
                    </div>

                    <ModalFooter>
                        {walletConnected && (
                            <PillButton size="lg" className="w-full" onClick={handleWithdraw} disabled={!isWeb3Connected || !web3Address || !amount}>
                                Withdraw
                            </PillButton>
                        )}
                        <PillButton variant="ghost" size="lg" className="w-full" onClick={onClose}>
                            Cancel
                        </PillButton>
                    </ModalFooter>
                </>
            )}

            {step === "initiating" && (
                <div role="status" className="text-center py-8">
                    <SpinnerRing toneClass="border-brand" />
                    <p className="text-ink font-semibold mb-2">Initiating Withdrawal</p>
                    <p className="text-ink-muted text-sm">Signing withdrawal request on Block52 chain...</p>
                </div>
            )}

            {step === "waiting_signature" && (
                <>
                    <div role="status" className="text-center py-4">
                        <SpinnerRing toneClass="border-amber-400" />
                        <p className="text-ink font-semibold mb-2">Waiting for Validator Signature</p>
                        <p className="text-ink-soft text-sm mb-4">Your withdrawal request has been submitted. Fetching a validator signature for the deposit contract...</p>
                        {txHash && <p className={`m-0 mb-2 text-xs font-mono text-ink-muted break-all ${insetBoxClass}`}>Cosmos Tx: {txHash.slice(0, 16)}...</p>}
                        <p className="text-ink-muted text-xs tabular-nums m-0">
                            Checking... ({pollCount} {pollCount === 1 ? "attempt" : "attempts"})
                        </p>

                        {pollCount > SLOW_POLL_THRESHOLD && (
                            <div className={`mt-4 text-left text-sm ${noticeClass.warning}`}>
                                Signing is taking longer than expected. The validator may need additional time. You can wait here or check the Withdrawal Dashboard
                                later.
                            </div>
                        )}
                    </div>
                    <ModalFooter>
                        <PillButton variant="ghost" size="lg" className="w-full !h-auto min-h-12 py-2 whitespace-normal" onClick={onClose}>
                            Close (withdrawal will continue in background)
                        </PillButton>
                    </ModalFooter>
                </>
            )}

            {step === "ready_to_complete" && withdrawalInfo && (
                <>
                    <div className="space-y-4">
                        <div className={`flex items-start gap-3 ${noticeClass.success}`}>
                            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/15 grid place-items-center" aria-hidden="true">
                                <CheckIcon className="w-4 h-4" />
                            </span>
                            <div>
                                <p className="m-0 font-semibold">Validator Signature Received</p>
                                <p className="m-0 mt-1 text-ink-soft">Your withdrawal is signed and ready to complete on Ethereum.</p>
                            </div>
                        </div>

                        <div className={`space-y-2 ${insetBoxClass}`}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">Amount</span>
                                <span className="text-xl font-semibold tabular-nums text-ink">{formatMicroAsUsdc(withdrawalInfo.amount, 6)} USDC</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">To</span>
                                <span className="text-ink font-mono text-xs">
                                    {withdrawalInfo.baseAddress.slice(0, 10)}...
                                    {withdrawalInfo.baseAddress.slice(-8)}
                                </span>
                            </div>
                        </div>

                        <p className="m-0 text-center text-xs text-ink-muted">You can complete this withdrawal later from the Withdrawal Dashboard</p>
                    </div>
                    <ModalFooter>
                        <PillButton size="lg" className="w-full" onClick={handleCompleteOnEthereum}>
                            Complete on Ethereum
                        </PillButton>
                        <PillButton variant="ghost" size="lg" className="w-full" onClick={onClose}>
                            Close
                        </PillButton>
                    </ModalFooter>
                </>
            )}

            {step === "completing_eth" && (
                <div role="status" className="text-center py-8">
                    <SpinnerRing toneClass="border-emerald-400" />
                    <p className="text-ink font-semibold mb-2">Completing on Ethereum</p>
                    <p className="text-ink-muted text-sm">Confirm the transaction in your wallet...</p>
                </div>
            )}

            {step === "done" && (
                <>
                    <div role="status" className="text-center py-4">
                        <span className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 grid place-items-center" aria-hidden="true">
                            <CheckIcon className="w-7 h-7" />
                        </span>
                        <p className="m-0 text-lg font-semibold text-ink">Withdrawal Complete!</p>
                        <p className="m-0 mt-2 text-sm text-ink-soft">USDC has been transferred to your Ethereum wallet.</p>
                        {ethTxHash && <p className={`m-0 mt-4 text-xs font-mono text-ink-muted break-all ${insetBoxClass}`}>Eth Tx: {ethTxHash.slice(0, 16)}...</p>}
                    </div>
                    <ModalFooter>
                        <PillButton size="lg" className="w-full" onClick={onClose}>
                            Close
                        </PillButton>
                    </ModalFooter>
                </>
            )}
        </Modal>
    );
};

export default WithdrawalModal;
