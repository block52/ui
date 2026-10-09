import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { truncateMiddle } from "../utils/stringUtils";
import { isEmpty } from "../utils/guards";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { copyToClipboard } from "../utils/clipboard";
import { ethers } from "ethers";
import { formatMicroAsUsdc, usdcToMicroBigInt, parseUsdcToMicro } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { base64ToHex } from "../utils/encodingUtils";
import { Modal } from "../components/common/Modal";
import { Card, CardHeader, PillButton, StatStrip } from "../components/ui";
import { amountInputClass, fieldInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "../components/modals/walletFormClasses";
import { COSMOS_BRIDGE_ADDRESS } from "../config/constants";
import useUserWalletConnect from "../hooks/wallet/useUserWalletConnect";
import { useWithdraw } from "../hooks/wallet/useWithdraw";
import SignatureModal from "../components/modals/SignatureModal";
import { useWithdrawalSignature } from "../hooks/wallet/useWithdrawalSignature";
import { describeWithdrawError } from "../utils/withdrawalSignature";

/**
 * WithdrawalDashboard - Interface for managing USDC withdrawals to Ethereum
 *
 * 2-step withdrawal flow:
 *   Step 1: User sends withdrawal request to Block52 (signed by cosmos key, eth address in message).
 *   Step 2: User calls the deposit contract withdraw() on Ethereum via MetaMask, with a
 *           validator's signature.
 *
 * This dashboard auto-polls for pending withdrawals so users see status updates in real time.
 */

interface Withdrawal {
    nonce: string;
    cosmosAddress: string;
    baseAddress: string;
    amount: string;
    amountFormatted: string;
    status: "pending" | "signed" | "completed" | "error";
    signature?: string;
    errorMessage?: string;
    txHash?: string;
}

export default function WithdrawalDashboard() {
    const cosmosWallet = useCosmosWallet();
    const { address: baseAddress, isConnected } = useUserWalletConnect();
    const { currentNetwork } = useNetwork();
    const { withdraw, hash, isWithdrawConfirmed, withdrawError } = useWithdraw();
    const fetchWithdrawalSignature = useWithdrawalSignature();
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingNonce, setProcessingNonce] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "signed" | "completed">("all");

    const [showInitiateModal, setShowInitiateModal] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState("");
    const [withdrawalBaseAddress, setWithdrawalBaseAddress] = useState("");
    const [isInitiating, setIsInitiating] = useState(false);

    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);

    // Bridge configuration - Ethereum Mainnet
    const bridgeContractAddress = COSMOS_BRIDGE_ADDRESS;

    useEffect(() => {
        if (isConnected && baseAddress) {
            setWithdrawalBaseAddress(baseAddress);
        }
    }, [isConnected, baseAddress]);

    const loadWithdrawals = useCallback(async () => {
        if (!cosmosWallet.address) {
            setWithdrawals([]);
            return;
        }

        setIsLoading(true);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            const withdrawalRequests = await signingClient.listWithdrawalRequests(cosmosWallet.address);

            const mappedWithdrawals: Withdrawal[] = withdrawalRequests.map((wr: any) => ({
                nonce: wr.nonce,
                cosmosAddress: wr.cosmos_address,
                baseAddress: wr.base_address,
                amount: wr.amount,
                amountFormatted: formatMicroAsUsdc(wr.amount, 6),
                status: wr.status as "pending" | "signed" | "completed",
                signature: wr.signature || undefined
            }));

            setWithdrawals(mappedWithdrawals);
        } catch (err) {
            console.error("Failed to load withdrawals:", err);
            toast.error(`Failed to load withdrawals: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    }, [cosmosWallet.address, currentNetwork]);

    const handleInitiateWithdrawal = async () => {
        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        if (!withdrawalBaseAddress) {
            toast.error("Please enter your Ethereum address");
            return;
        }

        if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        if (!ethers.isAddress(withdrawalBaseAddress)) {
            toast.error("Invalid Ethereum address");
            return;
        }

        setIsInitiating(true);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            const microAmount = parseUsdcToMicro(withdrawalAmount);

            const hash = await signingClient.initiateWithdrawal(withdrawalBaseAddress, microAmount);

            toast.success(
                <div>
                    <div className="font-semibold">Withdrawal initiated!</div>
                    <div className="text-sm mt-1">Transaction: {hash.slice(0, 10)}...</div>
                </div>
            );

            setShowInitiateModal(false);
            setWithdrawalAmount("");
            setWithdrawalBaseAddress(baseAddress || "");

            // Wait a bit and refresh withdrawals
            setTimeout(() => {
                loadWithdrawals();
            }, 2000);
        } catch (err) {
            console.error("Failed to initiate withdrawal:", err);
            toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setIsInitiating(false);
        }
    };

    const handleCompleteWithdrawal = async (withdrawal: Withdrawal) => {
        if (!isConnected || !baseAddress) {
            toast.error("Please connect your Ethereum wallet first");
            return;
        }

        setProcessingNonce(withdrawal.nonce);

        try {
            // Ask a validator first: the signature stored on chain can be overwritten with one the bridge rejects. Fall back to it only if no validator answers.
            const hexSignature = await fetchWithdrawalSignature(withdrawal).catch((err: unknown) => {
                if (!withdrawal.signature) throw err;
                console.error("No validator signature; using the one stored on chain:", err);
                return base64ToHex(withdrawal.signature);
            });

            await withdraw(
                withdrawal.nonce,
                withdrawal.baseAddress,
                BigInt(withdrawal.amount),
                hexSignature
            );

            toast.info(
                <div>
                    <div className="font-semibold">Withdrawal transaction submitted</div>
                    <div className="text-sm mt-1">Waiting for confirmation...</div>
                </div>
            );
        } catch (err) {
            console.error("Failed to complete withdrawal:", err);
            toast.error(describeWithdrawError(err));
            setProcessingNonce(null);
        }
    };

    useEffect(() => {
        if (isWithdrawConfirmed && processingNonce) {
            toast.success(
                <div>
                    <div className="font-semibold">Withdrawal completed!</div>
                    <div className="text-sm mt-1">USDC transferred successfully</div>
                </div>
            );

            setWithdrawals(prev =>
                prev.map(w =>
                    w.nonce === processingNonce ? { ...w, status: "completed" as const, txHash: hash } : w
                )
            );

            setProcessingNonce(null);

            setTimeout(() => {
                loadWithdrawals();
            }, 2000);
        }
    }, [isWithdrawConfirmed, processingNonce, hash, loadWithdrawals]);

    useEffect(() => {
        if (withdrawError && processingNonce) {
            console.error("Withdrawal error:", withdrawError);
            toast.error(describeWithdrawError(withdrawError));
            setProcessingNonce(null);
        }
    }, [withdrawError, processingNonce]);

    useEffect(() => {
        loadWithdrawals();
    }, [loadWithdrawals]);

    const autoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const hasPending = withdrawals.some(w => w.status === "pending");

        if (hasPending && cosmosWallet.address) {
            if (!autoPollRef.current) {
                autoPollRef.current = setInterval(() => {
                    loadWithdrawals();
                }, 5000);
            }
        } else {
            // No pending withdrawals - stop polling
            if (autoPollRef.current) {
                clearInterval(autoPollRef.current);
                autoPollRef.current = null;
            }
        }

        return () => {
            if (autoPollRef.current) {
                clearInterval(autoPollRef.current);
                autoPollRef.current = null;
            }
        };
    }, [withdrawals, cosmosWallet.address, loadWithdrawals]);

    const filteredWithdrawals = withdrawals.filter(withdrawal => {
        if (filter === "all") return true;
        return withdrawal.status === filter;
    });

    const totalWithdrawals = withdrawals.length;
    const pendingCount = withdrawals.filter(w => w.status === "pending").length;
    const signedCount = withdrawals.filter(w => w.status === "signed").length;
    const completedCount = withdrawals.filter(w => w.status === "completed").length;

    const handleViewSignature = (withdrawal: Withdrawal) => {
        setSelectedWithdrawal(withdrawal);
        setShowSignatureModal(true);
    };

    const selectedSignatureHex = useMemo(() => {
        if (!selectedWithdrawal?.signature) return null;
        try {
            return base64ToHex(selectedWithdrawal.signature);
        } catch {
            return null;
        }
    }, [selectedWithdrawal?.signature]);

    const statusPillClass: Record<Withdrawal["status"], string> = {
        pending: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        signed: "bg-brand/15 text-brand-light border-brand/30",
        completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        error: "bg-red-500/10 text-red-400 border-red-500/30"
    };
    const statusLabel: Record<Withdrawal["status"], string> = {
        pending: "Pending",
        signed: "Signed",
        completed: "Completed",
        error: "Error"
    };

    const thClass = "px-5 py-3 text-xs font-medium uppercase tracking-[0.1em] text-ink-muted whitespace-nowrap";
    const iconButtonClass =
        "shrink-0 w-11 h-11 sm:w-9 sm:h-9 grid place-items-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light";

    const copyIcon = (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
        </svg>
    );
    const eyeIcon = (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
        </svg>
    );

    const renderCompleteButton = (withdrawal: Withdrawal, withTitle: boolean) => (
        <PillButton
            size="sm"
            onClick={() => handleCompleteWithdrawal(withdrawal)}
            disabled={processingNonce === withdrawal.nonce || !isConnected || !baseAddress}
            title={withTitle && (!isConnected || !baseAddress) ? "Connect your Ethereum wallet first" : undefined}
        >
            {processingNonce === withdrawal.nonce ? "Completing..." : "Complete on Ethereum"}
        </PillButton>
    );

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
                <div>
                    <h1 className="m-0 text-[28px] font-semibold text-ink">USDC Withdrawals</h1>
                    <p className="mt-1 mb-0 text-ink-muted">
                        Withdraw USDC from Block52 to Ethereum
                        <span className="ml-2 font-mono text-xs text-ink-muted/80 break-all">({bridgeContractAddress})</span>
                    </p>
                </div>

                <StatStrip
                    items={[
                        { label: "Total Withdrawals", value: totalWithdrawals },
                        { label: "Pending", value: pendingCount },
                        { label: "Signed (Ready)", value: signedCount },
                        { label: "Completed", value: completedCount, tone: "good" }
                    ]}
                />

                <Card>
                    <CardHeader title="Wallets" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
                        <div className={insetBoxClass}>
                            <p className="m-0 mb-1 text-xs uppercase tracking-[0.08em] text-ink-muted">Block52 Wallet</p>
                            <p className={`m-0 font-mono text-sm break-all ${cosmosWallet.address ? "text-ink" : "text-ink-muted"}`}>
                                {cosmosWallet.address ? cosmosWallet.address : "Not connected"}
                            </p>
                        </div>
                        <div className={insetBoxClass}>
                            <p className="m-0 mb-1 text-xs uppercase tracking-[0.08em] text-ink-muted">Ethereum Wallet</p>
                            <p className={`m-0 font-mono text-sm break-all ${baseAddress ? "text-ink" : "text-ink-muted"}`}>
                                {baseAddress ? baseAddress : "Not connected"}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Withdrawals"
                        actions={
                            <>
                                <label htmlFor="withdrawal-filter" className="text-ink-muted text-sm">
                                    Filter:
                                </label>
                                <select
                                    id="withdrawal-filter"
                                    value={filter}
                                    onChange={e => setFilter(e.target.value as any)}
                                    className="h-11 sm:h-9 px-3 rounded-xl bg-surface-raised border border-line-strong text-ink text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 [color-scheme:dark]"
                                >
                                    <option value="all">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="signed">Signed</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <PillButton variant="outline" size="sm" onClick={loadWithdrawals} disabled={isLoading}>
                                    {isLoading ? "Loading..." : "Refresh"}
                                </PillButton>
                                <PillButton size="sm" onClick={() => setShowInitiateModal(true)} disabled={!cosmosWallet.address}>
                                    + New Withdrawal
                                </PillButton>
                            </>
                        }
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px]">
                            <thead>
                                <tr className="border-b border-line">
                                    <th className={`${thClass} text-left`}>Nonce</th>
                                    <th className={`${thClass} text-left`}>Ethereum Address</th>
                                    <th className={`${thClass} text-right`}>Amount (USDC)</th>
                                    <th className={`${thClass} text-center`}>Status</th>
                                    <th className={`${thClass} text-center`}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {isEmpty(filteredWithdrawals) ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-12 text-center text-ink-muted text-sm">
                                            {isLoading
                                                ? "Loading withdrawals..."
                                                : !cosmosWallet.address
                                                  ? "Connect your Block52 wallet to view withdrawals"
                                                  : "No withdrawals found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWithdrawals.map(withdrawal => (
                                        <tr key={withdrawal.nonce} className="hover:bg-surface-hover transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="text-ink font-mono text-sm" title={withdrawal.nonce}>
                                                    #{truncateMiddle(withdrawal.nonce, 10, 4)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-ink-body font-mono text-sm">{withdrawal.baseAddress}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(withdrawal.baseAddress, "Address copied!")}
                                                        className={iconButtonClass}
                                                        aria-label="Copy address"
                                                    >
                                                        {copyIcon}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right tabular-nums">
                                                <span className="text-ink font-semibold">{withdrawal.amountFormatted} USDC</span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-medium ${statusPillClass[withdrawal.status]} ${withdrawal.status === "error" ? "cursor-help" : ""}`}
                                                    title={withdrawal.status === "error" ? withdrawal.errorMessage : undefined}
                                                >
                                                    {statusLabel[withdrawal.status]}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {withdrawal.status === "signed" ? (
                                                        <>
                                                            {renderCompleteButton(withdrawal, false)}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewSignature(withdrawal)}
                                                                className={iconButtonClass}
                                                                title="View signature details"
                                                                aria-label="View signature details"
                                                            >
                                                                {eyeIcon}
                                                            </button>
                                                        </>
                                                    ) : withdrawal.status === "pending" ? (
                                                        // Redeemable now: the signature is fetched from a validator on click.
                                                        renderCompleteButton(withdrawal, true)
                                                    ) : withdrawal.status === "completed" && withdrawal.signature ? (
                                                        <PillButton
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewSignature(withdrawal)}
                                                            title="View signature details"
                                                        >
                                                            {eyeIcon}
                                                            View Sig
                                                        </PillButton>
                                                    ) : (
                                                        <span className="text-ink-muted text-sm">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div className={`${noticeClass.info} !p-4`}>
                    <h3 className="m-0 mb-2 text-sm font-semibold text-ink">How Withdrawals Work</h3>
                    <ul className="m-0 pl-4 space-y-1 list-disc text-ink-soft text-sm">
                        <li>
                            <strong className="text-ink">Step 1 (Block52):</strong> Send a withdrawal request signed by your cosmos address
                            with your Ethereum address in the message. The validator then signs the withdrawal payload
                            for the deposit contract.
                        </li>
                        <li>
                            <strong className="text-ink">Step 2 (Ethereum):</strong> Once the validator has signed, call the deposit
                            contract withdraw function on Ethereum using MetaMask.
                        </li>
                        <li>Pending withdrawals auto-refresh every 5 seconds until the validator signs.</li>
                        <li>Make sure your Ethereum wallet is connected before completing withdrawals.</li>
                    </ul>
                </div>
            </div>

            <Modal
                isOpen={showInitiateModal}
                onClose={() => {
                    setShowInitiateModal(false);
                    setWithdrawalAmount("");
                }}
                title="Initiate Withdrawal"
                isProcessing={isInitiating}
                closeOnBackdropClick={false}
                widthClass="w-[28rem]"
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="withdrawal-eth-address" className={fieldLabelClass}>
                            Ethereum Address
                        </label>
                        <input
                            id="withdrawal-eth-address"
                            type="text"
                            value={withdrawalBaseAddress}
                            onChange={e => setWithdrawalBaseAddress(e.target.value)}
                            placeholder="0x..."
                            className={`${fieldInputClass} font-mono text-sm`}
                        />
                        <p className="mt-1.5 mb-0 text-ink-muted text-xs">USDC will be sent to this address on Ethereum</p>
                    </div>

                    <div>
                        <label htmlFor="withdrawal-amount" className={fieldLabelClass}>
                            Amount (USDC)
                        </label>
                        <input
                            id="withdrawal-amount"
                            type="number"
                            step="0.000001"
                            min="0"
                            value={withdrawalAmount}
                            onChange={e => setWithdrawalAmount(e.target.value)}
                            placeholder="0.00"
                            className={amountInputClass}
                        />
                        <p className="mt-1.5 mb-0 text-ink-muted text-xs">Amount of USDC to withdraw from Block52</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <PillButton
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        onClick={() => {
                            setShowInitiateModal(false);
                            setWithdrawalAmount("");
                        }}
                        disabled={isInitiating}
                    >
                        Cancel
                    </PillButton>
                    <PillButton
                        size="lg"
                        className="flex-1"
                        onClick={handleInitiateWithdrawal}
                        disabled={isInitiating || !withdrawalBaseAddress || !withdrawalAmount}
                    >
                        {isInitiating ? "Initiating..." : "Initiate Withdrawal"}
                    </PillButton>
                </div>
            </Modal>

            <SignatureModal
                isOpen={showSignatureModal}
                onClose={() => {
                    setShowSignatureModal(false);
                    setSelectedWithdrawal(null);
                }}
                withdrawal={selectedWithdrawal}
                signatureHex={selectedSignatureHex}
                bridgeContractAddress={bridgeContractAddress}
            />
        </div>
    );
}
