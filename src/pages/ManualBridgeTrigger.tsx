import { useState } from "react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import { formatMicroAsUsdc } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { BRIDGE_DEPOSITS_ABI } from "../utils/bridge/abis";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { Card, CardHeader, PillButton } from "../components/ui";
import { fieldInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "../components/modals/walletFormClasses";
import { copyToClipboard } from "../utils/clipboard";
import { COSMOS_BRIDGE_ADDRESS } from "../config/constants";
/**
 * ManualBridgeTrigger - Simple page to manually process bridge deposits
 *
 * MVP Features:
 * - Input field for deposit index
 * - "Query" button to preview deposit info
 * - "Process Deposit" button
 * - Status display
 * - Transaction hash on success
 */

export default function ManualBridgeTrigger() {
    const cosmosWallet = useCosmosWallet();
    const { currentNetwork } = useNetwork();
    const [depositIndex, setDepositIndex] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isQuerying, setIsQuerying] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [depositDetails, setDepositDetails] = useState<any>(null);
    const [queryResult, setQueryResult] = useState<{ recipient: string; amount: string } | null>(null);

    // Bridge configuration - Ethereum Mainnet
    const bridgeContractAddress = COSMOS_BRIDGE_ADDRESS;
    const ethRpcUrl = import.meta.env.VITE_MAINNET_RPC_URL || import.meta.env.VITE_MAINNET_RPC_URL;

    const handleQueryDeposit = async () => {
        const index = parseInt(depositIndex);
        if (isNaN(index) || index < 0) {
            setError("Please enter a valid deposit index (0 or greater)");
            return;
        }

        if (!ethRpcUrl) {
            setError("Ethereum RPC URL not configured. Please add VITE_MAINNET_RPC_URL to .env file.");
            return;
        }

        setIsQuerying(true);
        setError(null);
        setQueryResult(null);

        try {
            // Connect to Ethereum Mainnet
            const provider = new ethers.JsonRpcProvider(ethRpcUrl);
            const contract = new ethers.Contract(bridgeContractAddress, BRIDGE_DEPOSITS_ABI, provider);

            // Query the deposit
            const [recipient, amount] = await contract.deposits(index);

            if (recipient === ethers.ZeroAddress || recipient === "") {
                setError(`Deposit ${index} not found or is empty`);
                setQueryResult(null);
            } else {
                setQueryResult({
                    recipient,
                    amount: amount.toString()
                });
                toast.success("Deposit data retrieved successfully!");
            }
        } catch (err) {
            console.error("Failed to query deposit:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
            setError(`Query failed: ${errorMessage}`);
            toast.error(`Query failed: ${errorMessage}`);
        } finally {
            setIsQuerying(false);
        }
    };

    const handleProcessDeposit = async () => {
        const index = parseInt(depositIndex);
        if (isNaN(index) || index < 0) {
            setError("Please enter a valid deposit index (0 or greater)");
            return;
        }

        if (!cosmosWallet.address) {
            setError("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setTxHash(null);
        setDepositDetails(null);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            // Process the deposit
            const hash = await signingClient.processDeposit(index);

            // Wait a bit then query the transaction for details and check if it succeeded
            setTimeout(async () => {
                try {
                    const txResponse = await signingClient.getTx(hash);
                    setDepositDetails(txResponse);

                    // Check if transaction actually succeeded (code 0 = success, non-zero = error)
                    // Handle both possible response structures
                    const code = txResponse.tx_response?.code ?? txResponse.code ?? 0;
                    const rawLog = txResponse.tx_response?.raw_log ?? txResponse.raw_log ?? "";

                    if (code !== 0) {
                        const errorMsg = rawLog || "Transaction failed";
                        setError(errorMsg);
                        setTxHash(null);
                        toast.error(`Failed: ${errorMsg}`);
                    } else {
                        setTxHash(hash);
                        toast.success(`Deposit ${index} processed successfully!`);
                    }
                } catch {
                    // If we can't fetch details, still show the hash but with a warning
                    setTxHash(hash);
                    toast.warning(`Deposit processed (hash: ${hash.substring(0, 10)}...), but couldn't verify details. Check explorer.`);
                }
            }, 2000);
        } catch (err) {
            let errorMessage = err instanceof Error ? err.message : "Unknown error occurred";

            // Add more helpful error messages for common issues
            if (errorMessage.includes("not valid JSON") || errorMessage.includes("<html>")) {
                errorMessage =
                    "Network endpoint returned invalid response. Please check your network configuration (RPC/REST URLs) or try a different network from the dropdown.";
            } else if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
                errorMessage = `Network error: ${errorMessage}. Check your connection and network configuration.`;
            }

            setError(errorMessage);
            toast.error(`Failed: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
                {/* Header */}
                <div>
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Manual Bridge Trigger</h1>
                    <p className="mt-1 mb-0 text-ink-muted">Process Ethereum deposits manually by deposit index</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col gap-6 min-w-0">
                        {/* Wallet Info */}
                        <Card>
                            <CardHeader title="Block52 Wallet" />
                            <div className="p-5">
                                {cosmosWallet.address ? (
                                    <div className="flex flex-col gap-2">
                                        <div className={`${insetBoxClass} flex flex-wrap items-center justify-between gap-x-4 gap-y-1`}>
                                            <span className="text-ink-muted text-sm">Address:</span>
                                            <span className="text-ink font-mono text-sm break-all">{cosmosWallet.address}</span>
                                        </div>
                                        <div className={`${insetBoxClass} flex items-center justify-between gap-4`}>
                                            <span className="text-ink-muted text-sm">Balance:</span>
                                            <span className="text-ink tabular-nums">
                                                {formatMicroAsUsdc(cosmosWallet.balance.find(b => b.denom === "usdc")?.amount || "0", 6)} USDC
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={`${noticeClass.warning} m-0`}>No wallet connected. Please import a wallet first.</p>
                                )}
                            </div>
                        </Card>

                        {/* Process Deposit Card */}
                        <Card>
                            <CardHeader title="Process Deposit" />
                            <div className="p-5 flex flex-col gap-4">
                                {/* Input */}
                                <div>
                                    <label htmlFor="deposit-index" className={fieldLabelClass}>
                                        Deposit Index
                                    </label>
                                    <input
                                        id="deposit-index"
                                        type="number"
                                        min="0"
                                        value={depositIndex}
                                        onChange={e => setDepositIndex(e.target.value)}
                                        placeholder="Enter deposit index (e.g., 0, 1, 2...)"
                                        className={`${fieldInputClass} h-11 disabled:opacity-50`}
                                        disabled={isProcessing || isQuerying}
                                    />
                                    <p className="text-xs text-ink-muted mt-2 mb-0">The index of the deposit in the Ethereum bridge contract</p>
                                </div>

                                {/* Query Button */}
                                <PillButton variant="outline" onClick={handleQueryDeposit} disabled={isQuerying || isProcessing} className="w-full">
                                    {isQuerying ? (
                                        <>
                                            <LoadingSpinner size="md" />
                                            Querying...
                                        </>
                                    ) : (
                                        "Query Deposit from Ethereum"
                                    )}
                                </PillButton>

                                {/* Query Result Display */}
                                {queryResult && (
                                    <div className={`${noticeClass.info} !p-4`}>
                                        <p className="m-0 mb-3 text-sm font-medium text-ink">Deposit Information</p>
                                        <div className="flex flex-col gap-2">
                                            <div>
                                                <p className="m-0 text-xs text-ink-muted">Recipient (Block52 Address):</p>
                                                <p className="m-0 text-ink text-sm font-mono break-all">{queryResult.recipient}</p>
                                            </div>
                                            <div>
                                                <p className="m-0 text-xs text-ink-muted">Amount:</p>
                                                <p className="m-0 text-ink text-sm font-mono">{formatMicroAsUsdc(queryResult.amount, 6)} USDC</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Process Button */}
                                <PillButton onClick={handleProcessDeposit} disabled={isProcessing || isQuerying || !cosmosWallet.address} className="w-full">
                                    {isProcessing ? (
                                        <>
                                            <LoadingSpinner size="md" />
                                            Processing...
                                        </>
                                    ) : (
                                        "Process Deposit on Block52"
                                    )}
                                </PillButton>

                                {/* Error Display */}
                                {error && (
                                    <div className={noticeClass.error}>
                                        <p className="m-0 font-medium">Error</p>
                                        <p className="m-0 mt-1 break-words">{error}</p>
                                    </div>
                                )}

                                {/* Success Display */}
                                {txHash && (
                                    <div className={noticeClass.success}>
                                        <p className="m-0 mb-2 font-medium">Success!</p>
                                        <div className="flex flex-col gap-2">
                                            <div>
                                                <p className="m-0 text-xs opacity-80">Transaction Hash:</p>
                                                <div className="flex items-center gap-1">
                                                    <p className="m-0 text-ink text-sm font-mono break-all">{txHash}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(txHash, "Transaction hash copied!")}
                                                        aria-label="Copy transaction hash"
                                                        className="w-11 h-11 sm:w-8 sm:h-8 grid place-items-center rounded-full flex-shrink-0 text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {depositDetails && (
                                                <div className="mt-2 pt-3 border-t border-emerald-500/30">
                                                    <p className="m-0 mb-2 text-xs opacity-80">Deposit Details:</p>
                                                    <pre className="m-0 text-ink-body text-xs bg-surface-page border border-line p-3 rounded-xl overflow-auto max-h-48">
                                                        {JSON.stringify(depositDetails, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Instructions */}
                    <Card>
                        <CardHeader title="How it works:" level="h3" />
                        <ol className="m-0 p-5 pl-9 text-ink-soft text-sm flex flex-col gap-2 list-decimal">
                            <li>User deposits USDC on Ethereum to bridge contract</li>
                            <li>Deposit is logged with an incremental index (0, 1, 2, ...)</li>
                            <li>Enter the deposit index and click "Query" to preview deposit info</li>
                            <li>Click "Process" to mint USDC on Block52 chain</li>
                            <li>Chain queries Ethereum contract for deposit data</li>
                            <li>If valid and not processed, mints USDC on Block52</li>
                        </ol>
                    </Card>
                </div>
            </div>
        </div>
    );
}
