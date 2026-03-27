import { useState, useEffect, useCallback, useMemo } from "react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import { formatMicroAsUsdc } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { BRIDGE_DEPOSITS_ABI } from "../utils/bridge/abis";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { PROXY_URL, COSMOS_BRIDGE_ADDRESS } from "../config/constants";
import { useCosmosApi } from "../context/CosmosApiContext";
import { usePaymentApi } from "../context/PaymentApiContext";

// Minimum STAKE needed for gas fees (transaction costs ~2000 stake)
const MIN_STAKE_FOR_GAS = 2000;

/**
 * BridgeAdminDashboard - Admin interface for viewing and processing bridge deposits
 *
 * Features:
 * - View all deposits from Ethereum bridge contract
 * - See processing status for each deposit
 * - Process individual deposits
 * - Filter by status (all/processed/pending)
 */

interface Deposit {
    index: number;
    recipient: string;
    amount: string;
    amountFormatted: string;
    status: "loading" | "processed" | "pending" | "error";
    errorMessage?: string;
    txHash?: string;
}

interface ProcessedResponse {
    processed: boolean | string; // API might return boolean or string "true"/"false"
}

interface HotWalletInfo {
    address: string;
    ethBalance: string;
    usdcBalance: string;
    bridgeApproved: boolean;
}

interface ManualBridgeResponse {
    success: boolean;
    message: string;
    txHash: string;
    cosmosAddress: string;
    amount: string;
    etherscanUrl: string;
}

interface ApproveBridgeResponse {
    success: boolean;
    message: string;
    txHash: string;
    etherscanUrl: string;
}

export default function BridgeAdminDashboard() {
    const cosmosWallet = useCosmosWallet();
    const { currentNetwork } = useNetwork();
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    // Load items per page from localStorage, default to 50
    const [itemsPerPage, setItemsPerPage] = useState(() => {
        const saved = localStorage.getItem("bridge_items_per_page");
        return saved ? parseInt(saved) : 50;
    });
    const [totalDepositsFound, setTotalDepositsFound] = useState(0);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [isProcessingAll, setIsProcessingAll] = useState(false);
    const [filter, setFilter] = useState<"all" | "processed" | "pending">("all");
    // Load sort order from localStorage, default to descending (newest first)
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
        const saved = localStorage.getItem("bridge_sort_order");
        return (saved as "asc" | "desc") || "desc";
    });
    const [configError, setConfigError] = useState<string | null>(null);

    // Manual bridge state
    const [manualCosmosAddress, setManualCosmosAddress] = useState("");
    const [manualAmount, setManualAmount] = useState("");
    const [isManualBridging, setIsManualBridging] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [showManualBridge, setShowManualBridge] = useState(false);
    const [hotWalletInfo, setHotWalletInfo] = useState<HotWalletInfo | null>(null);
    const [isLoadingHotWallet, setIsLoadingHotWallet] = useState(false);

    // Ethereum Mainnet configuration
    const bridgeContractAddress = COSMOS_BRIDGE_ADDRESS;
    const ethRpcUrl = import.meta.env.VITE_MAINNET_RPC_URL || import.meta.env.VITE_MAINNET_RPC_URL;

    // Get STAKE balance from wallet for gas fees
    const stakeBalance = useMemo(() => {
        const balance = cosmosWallet.balance.find(b => b.denom === "stake");
        return balance ? parseInt(balance.amount) : 0;
    }, [cosmosWallet.balance]);

    // Check if user has enough STAKE for gas fees
    const hasEnoughStake = stakeBalance >= MIN_STAKE_FOR_GAS;
    const stakeBalanceFormatted = formatMicroAsUsdc(stakeBalance, 2);

    const api = useCosmosApi(currentNetwork.rest);
    const paymentApi = usePaymentApi();

    // Validate Alchemy URL is configured
    useEffect(() => {
        if (!import.meta.env.VITE_MAINNET_RPC_URL) {
            const errorMsg =
                "⚠️ VITE_MAINNET_RPC_URL is not configured in .env file. Please add your Alchemy API key to enable bridge deposit queries. See ui/README.md for setup instructions.";
            setConfigError(errorMsg);
            console.error(errorMsg);
            toast.error("Alchemy API key not configured. Bridge queries may fail.");
        }
    }, []);

    // Check if deposits have been processed on Cosmos
    const checkProcessingStatus = useCallback(
        async (depositsToCheck: Deposit[]) => {
            try {
                // We need to check the deterministic txHash for each deposit
                // txHash = sha256(contractAddress + depositIndex)
                const updatedDeposits = await Promise.all(
                    depositsToCheck.map(async deposit => {
                        try {
                            // Generate deterministic txHash (same as backend)
                            const txHashInput = `${bridgeContractAddress}-${deposit.index}`;
                            const encoder = new TextEncoder();
                            const data = encoder.encode(txHashInput);
                            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            const txHash = "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
                            // Query Cosmos to see if this txHash has been processed
                            const response = (await api.getIsTxProcessed(txHash)) as ProcessedResponse;
                            if (response) {
                                const isProcessed = response.processed === true || response.processed === "true";

                                return {
                                    ...deposit,
                                    status: isProcessed ? ("processed" as const) : ("pending" as const),
                                    txHash
                                };
                            } else {
                                // API error, mark as pending
                                return {
                                    ...deposit,
                                    status: "pending" as const,
                                    txHash
                                };
                            }
                        } catch (err) {
                            console.error(`Failed to check status for deposit ${deposit.index}:`, err);
                            return {
                                ...deposit,
                                status: "pending" as const
                            };
                        }
                    })
                );

                setDeposits(updatedDeposits);
            } catch (err) {
                console.error("Failed to check processing status:", err);
            }
        },
        [currentNetwork, bridgeContractAddress]
    );

    // Load deposits from Ethereum contract
    const loadDeposits = useCallback(async () => {
        setIsLoading(true);
        const newDeposits: Deposit[] = [];

        try {
            // Connect to Ethereum
            const provider = new ethers.JsonRpcProvider(ethRpcUrl);
            const contract = new ethers.Contract(bridgeContractAddress, BRIDGE_DEPOSITS_ABI, provider);

            // Calculate start and end indices based on current page
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;

            // Query deposits by index for current page
            for (let i = startIndex; i < endIndex; i++) {
                try {
                    const [account, amount] = await contract.deposits(i);

                    // If account is empty, deposit doesn't exist
                    if (!account || account === "") {
                        setTotalDepositsFound(i); // Set total to the last found index
                        break;
                    }

                    newDeposits.push({
                        index: i,
                        recipient: account,
                        amount: amount.toString(),
                        amountFormatted: formatMicroAsUsdc(amount.toString(), 6),
                        status: "loading" // Will check processing status next
                    });
                } catch (err: any) {
                    console.error(`Failed to query deposit ${i}:`, err);
                    // If we get an error, likely reached the end
                    setTotalDepositsFound(i);
                    break;
                }
            }

            // If we got all items for this page, there might be more
            if (newDeposits.length === itemsPerPage) {
                // Check if next item exists to determine if there are more pages
                try {
                    const [account] = await contract.deposits(endIndex);
                    if (account && account !== "") {
                        setTotalDepositsFound(endIndex + 1); // At least one more exists
                    } else {
                        setTotalDepositsFound(endIndex); // This is the last page
                    }
                } catch {
                    setTotalDepositsFound(endIndex); // Assume this is the last page
                }
            }

            setDeposits(newDeposits);

            // Now check processing status for each deposit
            await checkProcessingStatus(newDeposits);
        } catch (err: any) {
            console.error("Failed to load deposits:", err);
            toast.error(`Failed to load deposits: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, itemsPerPage, ethRpcUrl, checkProcessingStatus]);

    // Process a single deposit
    const handleProcessDeposit = async (depositIndex: number) => {
        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        setProcessingIndex(depositIndex);

        try {
            const { signingClient } = await getSigningClient(currentNetwork);

            // Process the deposit
            const hash = await signingClient.processDeposit(depositIndex);

            // Wait for transaction confirmation
            setTimeout(async () => {
                try {
                    const txResponse = await signingClient.getTx(hash);

                    if (txResponse.tx_response.code !== 0) {
                        const errorMsg = txResponse.tx_response.raw_log || "Transaction failed";
                        toast.error(`Failed: ${errorMsg}`);

                        // Update deposit status to show error
                        setDeposits(prev => prev.map(d => (d.index === depositIndex ? { ...d, status: "error" as const, errorMessage: errorMsg } : d)));
                    } else {
                        toast.success(`Deposit ${depositIndex} processed successfully!`);

                        // Update deposit status to processed
                        setDeposits(prev => prev.map(d => (d.index === depositIndex ? { ...d, status: "processed" as const } : d)));
                    }
                } catch (err) {
                    toast.success(`Deposit ${depositIndex} processed successfully!`);

                    // Update deposit status to processed
                    setDeposits(prev => prev.map(d => (d.index === depositIndex ? { ...d, status: "processed" as const } : d)));
                }
            }, 2000);
        } catch (err: any) {
            console.error("Failed to process deposit:", err);
            const errorMessage = err.message || "Unknown error occurred";
            toast.error(`Failed: ${errorMessage}`);

            // Update deposit status to show error
            setDeposits(prev => prev.map(d => (d.index === depositIndex ? { ...d, status: "error" as const, errorMessage } : d)));
        } finally {
            setProcessingIndex(null);
        }
    };

    // Load deposits on mount and when page changes
    useEffect(() => {
        loadDeposits();
    }, [currentPage, itemsPerPage, loadDeposits]);

    // Load hot wallet info
    const loadHotWalletInfo = useCallback(async () => {
        setIsLoadingHotWallet(true);
        try {
            const walletInfo = (await paymentApi.getHotWalletInfo()) as HotWalletInfo;
            if (walletInfo) {
                setHotWalletInfo(walletInfo);
            } else {
                console.error("Failed to load hot wallet info");
            }
        } catch (err) {
            console.error("Error loading hot wallet info:", err);
        } finally {
            setIsLoadingHotWallet(false);
        }
    }, []);

    // Load hot wallet info on mount
    useEffect(() => {
        loadHotWalletInfo();
    }, [loadHotWalletInfo]);

    // Handle manual bridge submission
    const handleManualBridge = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!manualCosmosAddress || !manualAmount) {
            toast.error("Please enter both Block52 address and amount");
            return;
        }

        if (!manualCosmosAddress.startsWith("b52")) {
            toast.error("Block52 address must start with 'b52'");
            return;
        }

        const amount = parseFloat(manualAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Amount must be a positive number");
            return;
        }

        setIsManualBridging(true);

        try {
            const response = (await paymentApi.manualBridge({
                cosmosAddress: manualCosmosAddress,
                amount: manualAmount
            })) as ManualBridgeResponse;

            if (response.success) {
                toast.success(`Bridge successful! TX: ${response.txHash.slice(0, 10)}...`);
                setManualCosmosAddress("");
                setManualAmount("");
                // Reload hot wallet info
                loadHotWalletInfo();
                // Reload deposits to show the new one
                loadDeposits();
            } else {
                toast.error(response.message || "Bridge failed");
            }
        } catch (err: any) {
            console.error("Manual bridge error:", err);
            toast.error(`Bridge failed: ${err.error}`);
        } finally {
            setIsManualBridging(false);
        }
    };

    // Handle approve bridge
    const handleApproveBridge = async () => {
        setIsApproving(true);
        try {
            const response = (await paymentApi.approveBridge()) as ApproveBridgeResponse;

            if (response.success) {
                toast.success(response.message);
                loadHotWalletInfo();
            } else {
                toast.error(response.message || "Approval failed");
            }
        } catch (err: any) {
            console.error("Approve error:", err);
            toast.error(`Approval failed: ${err.error}`);
        } finally {
            setIsApproving(false);
        }
    };

    // Handle items per page change - save to localStorage
    const handleItemsPerPageChange = (value: number) => {
        setItemsPerPage(value);
        localStorage.setItem("bridge_items_per_page", value.toString());
        setCurrentPage(1);
    };

    // Handle sort order change - save to localStorage
    const handleSortOrderChange = () => {
        const newOrder = sortOrder === "desc" ? "asc" : "desc";
        setSortOrder(newOrder);
        localStorage.setItem("bridge_sort_order", newOrder);
    };

    // Process all pending deposits
    const handleProcessAllPending = async () => {
        const pendingDeposits = deposits.filter(d => d.status === "pending");
        if (pendingDeposits.length === 0) {
            toast.info("No pending deposits to process");
            return;
        }

        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
            return;
        }

        if (!hasEnoughStake) {
            toast.error("Insufficient STAKE for gas fees");
            return;
        }

        setIsProcessingAll(true);
        let successCount = 0;
        let failCount = 0;

        for (const deposit of pendingDeposits) {
            try {
                const { signingClient } = await getSigningClient(currentNetwork);

                await signingClient.processDeposit(deposit.index);

                // Update deposit status to processed
                setDeposits(prev => prev.map(d => (d.index === deposit.index ? { ...d, status: "processed" as const } : d)));
                successCount++;

                // Small delay between transactions
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err: any) {
                console.error(`Failed to process deposit ${deposit.index}:`, err);
                setDeposits(prev => prev.map(d => (d.index === deposit.index ? { ...d, status: "error" as const, errorMessage: err.message } : d)));
                failCount++;
            }
        }

        setIsProcessingAll(false);

        if (successCount > 0) {
            toast.success(`Processed ${successCount} deposit${successCount > 1 ? "s" : ""} successfully!`);
        }
        if (failCount > 0) {
            toast.error(`Failed to process ${failCount} deposit${failCount > 1 ? "s" : ""}`);
        }
    };

    // Filter deposits based on selected filter and sort by index
    const filteredDeposits = deposits
        .filter(deposit => {
            if (filter === "all") return true;
            return deposit.status === filter;
        })
        .sort((a, b) => (sortOrder === "desc" ? b.index - a.index : a.index - b.index));

    // Stats
    const totalDeposits = deposits.length;
    const processedCount = deposits.filter(d => d.status === "processed").length;
    const pendingCount = deposits.filter(d => d.status === "pending").length;
    const totalPages = totalDepositsFound > 0 ? Math.ceil(totalDepositsFound / itemsPerPage) : 1;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Bridge Admin Dashboard</h1>
                    <p className="text-gray-400">
                        View and process Ethereum USDC bridge deposits
                        <span className="ml-2 font-mono text-sm text-gray-500">({bridgeContractAddress})</span>
                    </p>
                </div>

                {/* Configuration Error Warning */}
                {configError && (
                    <div className="mb-6 bg-red-900/30 border-2 border-red-700 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-red-200 font-semibold mb-1">Configuration Required</h3>
                                <p className="text-red-300 text-sm">{configError}</p>
                                <div className="mt-2 text-red-300 text-xs font-mono bg-red-950/50 p-2 rounded">
                                    Add to .env: VITE_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Insufficient STAKE Warning */}
                {cosmosWallet.address && !hasEnoughStake && (
                    <div className="mb-6 bg-yellow-900/30 border-2 border-yellow-700 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-yellow-200 font-semibold mb-1">Insufficient STAKE for Gas Fees</h3>
                                <p className="text-yellow-300/80 text-sm">
                                    You need STAKE tokens to pay for gas fees when processing deposits. Your current balance is{" "}
                                    <strong>{stakeBalanceFormatted} STAKE</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Bridge Section - Collapsible */}
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg mb-6 border border-purple-700 overflow-hidden">
                    <button
                        onClick={() => setShowManualBridge(!showManualBridge)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-purple-900/20 transition-colors"
                    >
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-2xl">🌉</span> Manual Bridge
                            {hotWalletInfo && (
                                <span className="text-sm font-normal text-gray-400 ml-2">
                                    ({parseFloat(hotWalletInfo.usdcBalance).toFixed(2)} USDC available)
                                </span>
                            )}
                        </h3>
                        <span className="text-gray-400 text-2xl">{showManualBridge ? "−" : "+"}</span>
                    </button>

                    {showManualBridge && (
                        <div className="p-6 pt-2 border-t border-purple-700/50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Hot Wallet Info */}
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
                                        <span>🔥</span> Hot Wallet
                                        <button
                                            onClick={loadHotWalletInfo}
                                            disabled={isLoadingHotWallet}
                                            className="ml-auto text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                                        >
                                            {isLoadingHotWallet ? "..." : "↻"}
                                        </button>
                                    </h4>
                                    {hotWalletInfo ? (
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Address:</span>
                                                <span className="text-white font-mono text-xs">
                                                    {hotWalletInfo.address.slice(0, 10)}...{hotWalletInfo.address.slice(-8)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">ETH Balance:</span>
                                                <span className="text-white">{parseFloat(hotWalletInfo.ethBalance).toFixed(6)} ETH</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">USDC Balance:</span>
                                                <span className="text-green-400 font-semibold">{parseFloat(hotWalletInfo.usdcBalance).toFixed(2)} USDC</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">Bridge Approved:</span>
                                                {hotWalletInfo.bridgeApproved ? (
                                                    <span className="text-green-400">✅ Yes</span>
                                                ) : (
                                                    <button
                                                        onClick={handleApproveBridge}
                                                        disabled={isApproving}
                                                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1"
                                                    >
                                                        {isApproving ? (
                                                            <>
                                                                <LoadingSpinner size="xs" />
                                                                Approving...
                                                            </>
                                                        ) : (
                                                            <>⚠️ Approve Now</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 text-sm">Loading...</div>
                                    )}
                                </div>

                                {/* Manual Bridge Form */}
                                <form onSubmit={handleManualBridge} className="bg-gray-900/50 rounded-lg p-4">
                                    <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
                                        <span>📤</span> Send USDC to Block52
                                    </h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Cosmos Address</label>
                                            <input
                                                type="text"
                                                value={manualCosmosAddress}
                                                onChange={e => setManualCosmosAddress(e.target.value)}
                                                placeholder="b52..."
                                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm font-mono focus:border-purple-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Amount (USDC)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={manualAmount}
                                                onChange={e => setManualAmount(e.target.value)}
                                                placeholder="9.71"
                                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isManualBridging || !manualCosmosAddress || !manualAmount}
                                            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isManualBridging ? (
                                                <>
                                                    <LoadingSpinner size="sm" />
                                                    Bridging...
                                                </>
                                            ) : (
                                                <>🚀 Bridge to Block52</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Total Deposits</p>
                        <p className="text-2xl font-bold text-white">{totalDeposits}</p>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
                        <p className="text-green-400 text-sm mb-1">Processed</p>
                        <p className="text-2xl font-bold text-green-300">{processedCount}</p>
                    </div>
                    <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-700">
                        <p className="text-yellow-400 text-sm mb-1">Pending</p>
                        <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
                    </div>
                    <div className={`rounded-lg p-4 border ${hasEnoughStake ? "bg-purple-900/30 border-purple-700" : "bg-red-900/30 border-red-700"}`}>
                        <p className={`text-sm mb-1 ${hasEnoughStake ? "text-purple-400" : "text-red-400"}`}>Your STAKE (Gas)</p>
                        <p className={`text-2xl font-bold ${hasEnoughStake ? "text-purple-300" : "text-red-300"}`}>{stakeBalanceFormatted}</p>
                    </div>
                </div>

                {/* Bridge Sync Status */}
                <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg p-4 mb-6 border border-cyan-700">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🔄</span>
                                <div>
                                    <p className="text-white font-semibold">Bridge Sync Status</p>
                                    <p className="text-gray-400 text-xs">Ethereum → Block52</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs">Total</p>
                                    <p className="text-white font-bold">{totalDepositsFound || deposits.length}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-green-400 text-xs">Processed</p>
                                    <p className="text-green-300 font-bold">{processedCount}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-yellow-400 text-xs">Pending</p>
                                    <p className="text-yellow-300 font-bold">{pendingCount}</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleProcessAllPending}
                            disabled={isProcessingAll || pendingCount === 0 || !cosmosWallet.address || !hasEnoughStake}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                            title={!hasEnoughStake ? "Need STAKE for gas fees" : pendingCount === 0 ? "No pending deposits" : ""}
                        >
                            {isProcessingAll ? (
                                <>
                                    <LoadingSpinner size="sm" />
                                    Processing...
                                </>
                            ) : (
                                <>⚡ Process All Pending ({pendingCount})</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-white text-sm">Items per page:</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={e => handleItemsPerPageChange(parseInt(e.target.value))}
                                    className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-white text-sm">Sort:</label>
                                <button
                                    onClick={handleSortOrderChange}
                                    className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                    {sortOrder === "desc" ? "↓ Newest First" : "↑ Oldest First"}
                                </button>
                            </div>
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
                                    <option value="processed">Processed</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>

                            <button
                                onClick={loadDeposits}
                                disabled={isLoading}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-600 flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        Loading...
                                    </>
                                ) : (
                                    "Refresh"
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex items-center justify-between border-t border-gray-700 pt-4">
                        <div className="text-gray-400 text-sm">
                            Page {currentPage} of {totalPages > 0 ? totalPages : 1} • Showing deposits {(currentPage - 1) * itemsPerPage} -{" "}
                            {Math.min(currentPage * itemsPerPage, totalDepositsFound > 0 ? totalDepositsFound : totalDeposits)}
                            {totalDepositsFound > 0 && ` of ${totalDepositsFound}`}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={!hasPrevPage || isLoading}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
                                title="First page"
                            >
                                ««
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={!hasPrevPage || isLoading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={!hasNextPage || isLoading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={!hasNextPage || isLoading}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
                                title="Last page"
                            >
                                »»
                            </button>
                        </div>
                    </div>
                </div>

                {/* Deposits Table */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Index</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Recipient</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 tracking-wider">Amount (USDC)</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredDeposits.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                            {isLoading ? "Loading deposits..." : "No deposits found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeposits.map(deposit => (
                                        <tr key={deposit.index} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-white font-mono text-sm">#{deposit.index}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-mono text-xs break-all" title={deposit.recipient}>
                                                        {deposit.recipient}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(deposit.recipient);
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
                                                <span className="text-white font-semibold">{deposit.amountFormatted} USDC</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {deposit.status === "loading" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-300 flex items-center gap-2 justify-center">
                                                        <LoadingSpinner size="xs" />
                                                        Loading...
                                                    </span>
                                                )}
                                                {deposit.status === "processed" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-900/50 text-green-300 border border-green-700">
                                                        ✅ Processed
                                                    </span>
                                                )}
                                                {deposit.status === "pending" && (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                                                        ⏳ Pending
                                                    </span>
                                                )}
                                                {deposit.status === "error" && (
                                                    <span
                                                        className="px-3 py-1 text-xs font-semibold rounded-full bg-red-900/50 text-red-300 border border-red-700 cursor-help"
                                                        title={deposit.errorMessage}
                                                    >
                                                        ❌ Error
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {deposit.status === "pending" || deposit.status === "error" ? (
                                                    <button
                                                        onClick={() => handleProcessDeposit(deposit.index)}
                                                        disabled={processingIndex === deposit.index || !cosmosWallet.address || !hasEnoughStake}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 justify-center mx-auto"
                                                        title={!hasEnoughStake ? "Need STAKE for gas fees" : ""}
                                                    >
                                                        {processingIndex === deposit.index ? (
                                                            <>
                                                                <LoadingSpinner size="xs" />
                                                                Processing...
                                                            </>
                                                        ) : !hasEnoughStake ? (
                                                            "No STAKE"
                                                        ) : (
                                                            "Process"
                                                        )}
                                                    </button>
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
                    <h3 className="text-blue-200 font-semibold mb-2">ℹ️ How This Works</h3>
                    <ul className="text-blue-300 text-sm space-y-1 list-disc list-inside">
                        <li>This dashboard queries the Ethereum bridge contract for all deposit events</li>
                        <li>Each deposit shows the Cosmos recipient address and USDC amount</li>
                        <li>Status indicates whether the deposit has been processed on Block52 chain</li>
                        <li>Click "Process" to mint USDC on Block52 for pending deposits</li>
                        <li>Processed deposits cannot be processed again (idempotency protection)</li>
                    </ul>
                </div>

                {/* Powered by Block52 Footer */}
                <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                    <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                        <div className="text-left mb-1">
                            <span className="text-xs text-white font-medium tracking-wide">POWERED BY</span>
                        </div>
                        <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}
