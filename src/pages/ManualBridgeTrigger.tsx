import { useState } from "react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import { formatMicroAsUsdc } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { BRIDGE_DEPOSITS_ABI } from "../utils/bridge/abis";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
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
        } catch (err: any) {
            console.error("Failed to query deposit:", err);
            const errorMessage = err.message || "Unknown error occurred";
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
                } catch (err: any) {
                    // If we can't fetch details, still show the hash but with a warning
                    setTxHash(hash);
                    toast.warning(`Deposit processed (hash: ${hash.substring(0, 10)}...), but couldn't verify details. Check explorer.`);
                }
            }, 2000);
        } catch (err: any) {
            let errorMessage = err.message || "Unknown error occurred";

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
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-2xl mx-auto relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Manual Bridge Trigger</h1>
                    <p className="text-gray-400">Process Ethereum deposits manually by deposit index</p>
                </div>

                {/* Wallet Info */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-3">Block52 Wallet</h2>
                    {cosmosWallet.address ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Address:</span>
                                <span className="text-white font-mono text-sm">{cosmosWallet.address}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Balance:</span>
                                <span className="text-white">{formatMicroAsUsdc(cosmosWallet.balance.find(b => b.denom === "usdc")?.amount || "0", 6)} USDC</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-yellow-500">No wallet connected. Please import a wallet first.</p>
                    )}
                </div>

                {/* Process Deposit Card */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Process Deposit</h2>

                    <div className="space-y-4">
                        {/* Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Deposit Index</label>
                            <input
                                type="number"
                                min="0"
                                value={depositIndex}
                                onChange={e => setDepositIndex(e.target.value)}
                                placeholder="Enter deposit index (e.g., 0, 1, 2...)"
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                disabled={isProcessing || isQuerying}
                            />
                            <p className="text-xs text-gray-500 mt-1">The index of the deposit in the Ethereum bridge contract</p>
                        </div>

                        {/* Query Button */}
                        <button
                            onClick={handleQueryDeposit}
                            disabled={isQuerying || isProcessing}
                            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                                isQuerying || isProcessing ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                            }`}
                        >
                            {isQuerying ? (
                                <span className="flex items-center justify-center gap-2">
                                    <LoadingSpinner size="md" />
                                    Querying...
                                </span>
                            ) : (
                                "Query Deposit from Ethereum"
                            )}
                        </button>

                        {/* Query Result Display */}
                        {queryResult && (
                            <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                                <p className="text-blue-200 text-sm font-medium mb-3">📦 Deposit Information</p>
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-blue-300 text-xs">Recipient (Block52 Address):</p>
                                        <p className="text-blue-100 text-sm font-mono break-all">{queryResult.recipient}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-300 text-xs">Amount:</p>
                                        <p className="text-blue-100 text-sm font-mono">{formatMicroAsUsdc(queryResult.amount, 6)} USDC</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Process Button */}
                        <button
                            onClick={handleProcessDeposit}
                            disabled={isProcessing || isQuerying || !cosmosWallet.address}
                            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                                isProcessing || isQuerying || !cosmosWallet.address
                                    ? "bg-gray-600 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                            }`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <LoadingSpinner size="md" />
                                    Processing...
                                </span>
                            ) : (
                                "Process Deposit on Block52"
                            )}
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
                            <p className="text-red-200 text-sm font-medium">Error</p>
                            <p className="text-red-300 text-sm mt-1">{error}</p>
                        </div>
                    )}

                    {/* Success Display */}
                    {txHash && (
                        <div className="mt-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
                            <p className="text-green-200 text-sm font-medium mb-2">Success! ✅</p>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-green-300 text-xs">Transaction Hash:</p>
                                    <p className="text-green-100 text-sm font-mono break-all">{txHash}</p>
                                </div>
                                {depositDetails && (
                                    <div className="mt-3 pt-3 border-t border-green-700">
                                        <p className="text-green-300 text-xs mb-2">Deposit Details:</p>
                                        <pre className="text-green-100 text-xs bg-gray-900 p-2 rounded overflow-auto max-h-48">
                                            {JSON.stringify(depositDetails, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <h3 className="text-blue-200 font-semibold mb-2">How it works:</h3>
                    <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
                        <li>User deposits USDC on Ethereum to bridge contract</li>
                        <li>Deposit is logged with an incremental index (0, 1, 2, ...)</li>
                        <li>Enter the deposit index and click "Query" to preview deposit info</li>
                        <li>Click "Process" to mint USDC on Block52 chain</li>
                        <li>Chain queries Ethereum contract for deposit data</li>
                        <li>If valid and not processed, mints USDC on Block52</li>
                    </ol>
                </div>
            </div>

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                </div>
            </div>
        </div>
    );
}
