import { useState, useEffect, useCallback } from "react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import { formatMicroAsUsdc, usdcToMicroBigInt } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { useConnection } from "wagmi";
import { BRIDGE_WITHDRAWAL_ABI } from "../utils/bridge/abis";
import { base64ToHex } from "../utils/encodingUtils";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { COSMOS_BRIDGE_ADDRESS } from "../config/constants";

/**
 * WithdrawalDashboard - Interface for managing USDC withdrawals to Ethereum
 *
 * Features:
 * - Initiate new withdrawals from Block52 to Ethereum
 * - View withdrawal status (pending/signed/completed)
 * - Complete signed withdrawals on Ethereum
 * - 2-step withdrawal flow with automatic validator signing
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
    const { address: baseAddress, isConnected } = useConnection();
    const { currentNetwork } = useNetwork();
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingNonce, setProcessingNonce] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "signed" | "completed">("all");

    // Withdrawal initiation modal state
    const [showInitiateModal, setShowInitiateModal] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState("");
    const [withdrawalBaseAddress, setWithdrawalBaseAddress] = useState("");
    const [isInitiating, setIsInitiating] = useState(false);

    // Bridge configuration - Ethereum Mainnet
    const bridgeContractAddress = COSMOS_BRIDGE_ADDRESS;

    // Load withdrawal base address from connected wallet
    useEffect(() => {
        if (isConnected && baseAddress) {
            setWithdrawalBaseAddress(baseAddress);
        }
    }, [isConnected, baseAddress]);

    // Load withdrawals for current user
    const loadWithdrawals = useCallback(async () => {
        if (!cosmosWallet.address) {
            setWithdrawals([]);
            return;
        }

        setIsLoading(true);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            // Fetch withdrawal requests for this user
            const withdrawalRequests = await signingClient.listWithdrawalRequests(cosmosWallet.address);

            // Map to display format
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
        } catch (err: any) {
            console.error("Failed to load withdrawals:", err);
            toast.error(`Failed to load withdrawals: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [cosmosWallet.address, currentNetwork]);

    // Initiate a new withdrawal
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

        // Validate Base address format
        if (!ethers.isAddress(withdrawalBaseAddress)) {
            toast.error("Invalid Ethereum address");
            return;
        }

        setIsInitiating(true);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            // Convert USDC to micro (6 decimals)
            const microAmount = usdcToMicroBigInt(parseFloat(withdrawalAmount));

            // Initiate the withdrawal
            const hash = await signingClient.initiateWithdrawal(withdrawalBaseAddress, microAmount);

            toast.success(
                <div>
                    <div className="font-semibold">Withdrawal initiated!</div>
                    <div className="text-sm mt-1">Transaction: {hash.slice(0, 10)}...</div>
                </div>
            );

            // Close modal and reset form
            setShowInitiateModal(false);
            setWithdrawalAmount("");
            setWithdrawalBaseAddress(baseAddress || "");

            // Wait a bit and refresh withdrawals
            setTimeout(() => {
                loadWithdrawals();
            }, 2000);
        } catch (err: any) {
            console.error("Failed to initiate withdrawal:", err);
            toast.error(`Failed: ${err.message}`);
        } finally {
            setIsInitiating(false);
        }
    };

    // Complete a signed withdrawal on Ethereum
    const handleCompleteWithdrawal = async (withdrawal: Withdrawal) => {
        if (!isConnected || !baseAddress) {
            toast.error("Please connect your Ethereum wallet first");
            return;
        }

        if (!withdrawal.signature) {
            toast.error("Withdrawal not signed yet");
            return;
        }

        setProcessingNonce(withdrawal.nonce);

        try {
            // Get ethereum provider
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Create contract instance
            const contract = new ethers.Contract(bridgeContractAddress, BRIDGE_WITHDRAWAL_ABI, signer);

            // Convert base64 signature to hex format for ethers
            const hexSignature = withdrawal.signature ? base64ToHex(withdrawal.signature) : "0x";

            // Call withdraw on bridge contract with correct parameter order
            // Contract: withdraw(uint256 amount, address receiver, bytes32 nonce, bytes signature)
            const tx = await contract.withdraw(
                withdrawal.amount,        // uint256 amount
                withdrawal.baseAddress,   // address receiver (BASE address, not Cosmos!)
                withdrawal.nonce,         // bytes32 nonce
                hexSignature             // bytes signature
            );

            toast.info(
                <div>
                    <div className="font-semibold">Withdrawal transaction submitted</div>
                    <div className="text-sm mt-1">Waiting for confirmation...</div>
                </div>
            );

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                toast.success(
                    <div>
                        <div className="font-semibold">Withdrawal completed!</div>
                        <div className="text-sm mt-1">USDC transferred to {withdrawal.baseAddress.slice(0, 10)}...</div>
                    </div>
                );

                // Update withdrawal status to completed
                setWithdrawals(prev =>
                    prev.map(w =>
                        w.nonce === withdrawal.nonce ? { ...w, status: "completed" as const, txHash: receipt.hash } : w
                    )
                );

                // Refresh withdrawals from chain
                setTimeout(() => {
                    loadWithdrawals();
                }, 2000);
            } else {
                toast.error("Withdrawal transaction failed");
            }
        } catch (err: any) {
            console.error("Failed to complete withdrawal:", err);
            const errorMessage = err.message || "Unknown error occurred";
            toast.error(`Failed: ${errorMessage}`);
        } finally {
            setProcessingNonce(null);
        }
    };

    // Load withdrawals on mount and when wallet changes
    useEffect(() => {
        loadWithdrawals();
    }, [loadWithdrawals]);

    // Filter withdrawals based on selected filter
    const filteredWithdrawals = withdrawals.filter(withdrawal => {
        if (filter === "all") return true;
        return withdrawal.status === filter;
    });

    // Stats
    const totalWithdrawals = withdrawals.length;
    const pendingCount = withdrawals.filter(w => w.status === "pending").length;
    const signedCount = withdrawals.filter(w => w.status === "signed").length;
    const completedCount = withdrawals.filter(w => w.status === "completed").length;

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">USDC Withdrawals</h1>
                    <p className="text-gray-400">
                        Withdraw USDC from Block52 to Ethereum
                        <span className="ml-2 font-mono text-sm text-gray-500">({bridgeContractAddress})</span>
                    </p>
                </div>

                {/* Wallet Status */}
                <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Block52 Wallet</p>
                            <p className="text-white font-mono text-sm">
                                {cosmosWallet.address ? cosmosWallet.address : "Not connected"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Ethereum Wallet</p>
                            <p className="text-white font-mono text-sm">{baseAddress ? baseAddress : "Not connected"}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Total Withdrawals</p>
                        <p className="text-2xl font-bold text-white">{totalWithdrawals}</p>
                    </div>
                    <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-700">
                        <p className="text-yellow-400 text-sm mb-1">Pending Signature</p>
                        <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
                    </div>
                    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                        <p className="text-blue-400 text-sm mb-1">Signed (Ready)</p>
                        <p className="text-2xl font-bold text-blue-300">{signedCount}</p>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
                        <p className="text-green-400 text-sm mb-1">Completed</p>
                        <p className="text-2xl font-bold text-green-300">{completedCount}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowInitiateModal(true)}
                                disabled={!cosmosWallet.address}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                            >
                                + New Withdrawal
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-white text-sm">Filter:</label>
                                <select
                                    value={filter}
                                    onChange={e => setFilter(e.target.value as any)}
                                    className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                >
                                    <option value="all">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="signed">Signed</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <button
                                onClick={loadWithdrawals}
                                disabled={isLoading}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-600"
                            >
                                {isLoading ? "Loading..." : "Refresh"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Withdrawals Table */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Nonce</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">
                                        Ethereum Address
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 tracking-wider">
                                        Amount (USDC)
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredWithdrawals.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                            {isLoading
                                                ? "Loading withdrawals..."
                                                : !cosmosWallet.address
                                                  ? "Connect your Block52 wallet to view withdrawals"
                                                  : "No withdrawals found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWithdrawals.map(withdrawal => (
                                        <tr key={withdrawal.nonce} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-white font-mono text-sm">#{withdrawal.nonce}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-mono text-xs" title={withdrawal.baseAddress}>
                                                        {withdrawal.baseAddress.slice(0, 10)}...{withdrawal.baseAddress.slice(-8)}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(withdrawal.baseAddress);
                                                            toast.success("Address copied!");
                                                        }}
                                                        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-white font-semibold">{withdrawal.amountFormatted} USDC</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {withdrawal.status === "pending" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                                                        ⏳ Awaiting Signature
                                                    </span>
                                                )}
                                                {withdrawal.status === "signed" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-300 border border-blue-700">
                                                        ✍️ Signed (Ready)
                                                    </span>
                                                )}
                                                {withdrawal.status === "completed" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-900/50 text-green-300 border border-green-700">
                                                        ✅ Completed
                                                    </span>
                                                )}
                                                {withdrawal.status === "error" && (
                                                    <span
                                                        className="px-3 py-1 text-xs font-semibold rounded-full bg-red-900/50 text-red-300 border border-red-700 cursor-help"
                                                        title={withdrawal.errorMessage}
                                                    >
                                                        ❌ Error
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {withdrawal.status === "signed" ? (
                                                    <button
                                                        onClick={() => handleCompleteWithdrawal(withdrawal)}
                                                        disabled={
                                                            processingNonce === withdrawal.nonce || !isConnected || !baseAddress
                                                        }
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
                                                    >
                                                        {processingNonce === withdrawal.nonce
                                                            ? "Completing..."
                                                            : "Complete on Ethereum"}
                                                    </button>
                                                ) : withdrawal.status === "pending" ? (
                                                    <span className="text-gray-500 text-sm">Waiting for validator...</span>
                                                ) : (
                                                    <span className="text-gray-500 text-sm">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <h3 className="text-blue-200 font-semibold mb-2">ℹ️ How Withdrawals Work</h3>
                    <ul className="text-blue-300 text-sm space-y-1 list-disc list-inside">
                        <li>
                            <strong>Step 1:</strong> Click "New Withdrawal" to burn USDC on Block52 and create a withdrawal request
                        </li>
                        <li>
                            <strong>Step 2:</strong> Validators automatically sign your withdrawal (usually within a few blocks)
                        </li>
                        <li>
                            <strong>Step 3:</strong> Once signed, click "Complete on Ethereum" to receive USDC on Ethereum
                        </li>
                        <li>Make sure your Ethereum wallet is connected before completing withdrawals</li>
                        <li>Each withdrawal requires two transactions: one on Block52, one on Ethereum</li>
                    </ul>
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

            {/* Initiate Withdrawal Modal */}
            {showInitiateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
                        <h2 className="text-2xl font-bold text-white mb-4">Initiate Withdrawal</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-white text-sm font-semibold mb-2">Ethereum Address</label>
                                <input
                                    type="text"
                                    value={withdrawalBaseAddress}
                                    onChange={e => setWithdrawalBaseAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm"
                                />
                                <p className="text-gray-400 text-xs mt-1">
                                    USDC will be sent to this address on Ethereum
                                </p>
                            </div>

                            <div>
                                <label className="block text-white text-sm font-semibold mb-2">Amount (USDC)</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    min="0"
                                    value={withdrawalAmount}
                                    onChange={e => setWithdrawalAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-lg font-semibold"
                                />
                                <p className="text-gray-400 text-xs mt-1">Amount of USDC to withdraw from Block52</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowInitiateModal(false);
                                    setWithdrawalAmount("");
                                }}
                                disabled={isInitiating}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInitiateWithdrawal}
                                disabled={isInitiating || !withdrawalBaseAddress || !withdrawalAmount}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                            >
                                {isInitiating ? "Initiating..." : "Initiate Withdrawal"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
