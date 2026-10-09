import { useState, useEffect, useCallback } from "react";
import { truncateMiddle } from "../utils/stringUtils";
import { isEmpty, isBlank, hasContent } from "../utils/guards";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { copyToClipboard } from "../utils/clipboard";
import { ethers } from "ethers";
import { formatMicroAsUsdc } from "../constants/currency";
import { getSigningClient } from "../utils/cosmos/client";
import { BRIDGE_DEPOSITS_ABI } from "../utils/bridge/abis";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { Card, CardHeader, PillButton, StatStrip } from "../components/ui";
import { fieldInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "../components/modals/walletFormClasses";
import { COSMOS_BRIDGE_ADDRESS } from "../config/constants";
import { useCosmosApi } from "../context/CosmosApiContext";
import { usePaymentApi } from "../context/PaymentApiContext";
import { httpErrorMessage } from "../apis/HTTPClient";
import { STORAGE_KEYS } from "../constants/storageKeys";

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
        const saved = localStorage.getItem(STORAGE_KEYS.bridgeItemsPerPage);
        return saved ? parseInt(saved) : 50;
    });
    const [totalDepositsFound, setTotalDepositsFound] = useState(0);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [isProcessingAll, setIsProcessingAll] = useState(false);
    const [filter, setFilter] = useState<"all" | "processed" | "pending">("all");
    // Load sort order from localStorage, default to descending (newest first)
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.bridgeSortOrder);
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
                    if (isBlank(account)) {
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
                } catch (err) {
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
                    if (hasContent(account)) {
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
        } catch (err) {
            console.error("Failed to load deposits:", err);
            toast.error(`Failed to load deposits: ${err instanceof Error ? err.message : "Unknown error"}`);
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
        } catch (err) {
            console.error("Failed to process deposit:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
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
        } catch (err) {
            console.error("Manual bridge error:", err);
            toast.error(`Bridge failed: ${httpErrorMessage(err, "Unknown error")}`);
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
        } catch (err) {
            console.error("Approve error:", err);
            toast.error(`Approval failed: ${httpErrorMessage(err, "Unknown error")}`);
        } finally {
            setIsApproving(false);
        }
    };

    // Handle items per page change - save to localStorage
    const handleItemsPerPageChange = (value: number) => {
        setItemsPerPage(value);
        localStorage.setItem(STORAGE_KEYS.bridgeItemsPerPage, value.toString());
        setCurrentPage(1);
    };

    // Handle sort order change - save to localStorage
    const handleSortOrderChange = () => {
        const newOrder = sortOrder === "desc" ? "asc" : "desc";
        setSortOrder(newOrder);
        localStorage.setItem(STORAGE_KEYS.bridgeSortOrder, newOrder);
    };

    // Process all pending deposits
    const handleProcessAllPending = async () => {
        const pendingDeposits = deposits.filter(d => d.status === "pending");
        if (isEmpty(pendingDeposits)) {
            toast.info("No pending deposits to process");
            return;
        }

        if (!cosmosWallet.address) {
            toast.error("No Block52 wallet found. Please create or import a wallet first.");
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
            } catch (err) {
                console.error(`Failed to process deposit ${deposit.index}:`, err);
                setDeposits(prev => prev.map(d => (d.index === deposit.index ? { ...d, status: "error" as const, errorMessage: err instanceof Error ? err.message : "Unknown error" } : d)));
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

    const selectClass = `${fieldInputClass} h-11 w-auto py-0 pr-8 text-sm`;
    const pagerClass = "h-11 sm:h-9 min-w-11 sm:min-w-9 px-4 rounded-full border border-line text-sm text-ink-body hover:bg-surface-hover disabled:text-ink-muted/50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors";
    const thClass = "px-5 py-3 text-xs font-medium uppercase tracking-[0.1em] text-ink-muted";

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
                {/* Header */}
                <div>
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Bridge Admin Dashboard</h1>
                    <p className="mt-1 mb-0 text-ink-muted">
                        View and process Ethereum USDC bridge deposits
                        <span className="ml-2 font-mono text-sm break-all">({bridgeContractAddress})</span>
                    </p>
                </div>

                {/* Configuration Error Warning */}
                {configError && (
                    <div className={`${noticeClass.error} flex items-start gap-3`}>
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <h3 className="m-0 mb-1 font-semibold text-red-300">Configuration Required</h3>
                            <p className="m-0 text-sm">{configError}</p>
                            <div className="mt-2 text-xs font-mono bg-surface-page/60 border border-line p-2 rounded-lg break-all">
                                Add to .env: VITE_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <StatStrip
                    items={[
                        { label: "Total Deposits", value: totalDeposits },
                        { label: "Processed", value: processedCount, tone: "good" },
                        { label: "Pending", value: pendingCount, tone: pendingCount > 0 ? "default" : "muted" }
                    ]}
                />

                {/* Manual Bridge Section - Collapsible */}
                <Card>
                    <button
                        type="button"
                        onClick={() => setShowManualBridge(!showManualBridge)}
                        aria-expanded={showManualBridge}
                        className="w-full min-h-[56px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-light"
                    >
                        <h3 className="m-0 text-[17px] font-semibold text-ink flex flex-wrap items-baseline gap-x-3">
                            Manual Bridge
                            {hotWalletInfo && (
                                <span className="text-sm font-normal text-ink-muted">
                                    ({parseFloat(hotWalletInfo.usdcBalance).toFixed(2)} USDC available)
                                </span>
                            )}
                        </h3>
                        <span className="text-ink-muted text-2xl leading-none" aria-hidden="true">
                            {showManualBridge ? "−" : "+"}
                        </span>
                    </button>

                    {showManualBridge && (
                        <div className="p-5 border-t border-line">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Hot Wallet Info */}
                                <div className={`${insetBoxClass} p-4`}>
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <h4 className="m-0 text-sm font-semibold text-ink">Hot Wallet</h4>
                                        <PillButton variant="outline" size="sm" onClick={loadHotWalletInfo} disabled={isLoadingHotWallet} aria-label="Refresh hot wallet">
                                            {isLoadingHotWallet ? "..." : "↻"}
                                        </PillButton>
                                    </div>
                                    {hotWalletInfo ? (
                                        <div className="flex flex-col gap-2 text-sm">
                                            <div className="flex justify-between gap-3">
                                                <span className="text-ink-muted">Address:</span>
                                                <span className="text-ink font-mono text-xs">{truncateMiddle(hotWalletInfo.address, 10, 8)}</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <span className="text-ink-muted">ETH Balance:</span>
                                                <span className="text-ink tabular-nums">{parseFloat(hotWalletInfo.ethBalance).toFixed(6)} ETH</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <span className="text-ink-muted">USDC Balance:</span>
                                                <span className="text-emerald-400 font-semibold tabular-nums">{parseFloat(hotWalletInfo.usdcBalance).toFixed(2)} USDC</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-ink-muted">Bridge Approved:</span>
                                                {hotWalletInfo.bridgeApproved ? (
                                                    <span className="text-emerald-400">Yes</span>
                                                ) : (
                                                    <PillButton
                                                        size="sm"
                                                        onClick={handleApproveBridge}
                                                        disabled={isApproving}
                                                        className="!bg-amber-500 !text-surface-page hover:!bg-amber-400"
                                                    >
                                                        {isApproving ? (
                                                            <>
                                                                <LoadingSpinner size="xs" />
                                                                Approving...
                                                            </>
                                                        ) : (
                                                            "Approve Now"
                                                        )}
                                                    </PillButton>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-ink-muted text-sm">Loading...</div>
                                    )}
                                </div>

                                {/* Manual Bridge Form */}
                                <form onSubmit={handleManualBridge} className={`${insetBoxClass} p-4`}>
                                    <h4 className="m-0 mb-3 text-sm font-semibold text-ink">Send USDC to Block52</h4>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label htmlFor="manual-cosmos-address" className={fieldLabelClass}>
                                                Cosmos Address
                                            </label>
                                            <input
                                                id="manual-cosmos-address"
                                                type="text"
                                                value={manualCosmosAddress}
                                                onChange={e => setManualCosmosAddress(e.target.value)}
                                                placeholder="b52..."
                                                className={`${fieldInputClass} h-11 bg-surface-card font-mono text-sm`}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="manual-amount" className={fieldLabelClass}>
                                                Amount (USDC)
                                            </label>
                                            <input
                                                id="manual-amount"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={manualAmount}
                                                onChange={e => setManualAmount(e.target.value)}
                                                placeholder="9.71"
                                                className={`${fieldInputClass} h-11 bg-surface-card text-sm`}
                                            />
                                        </div>
                                        <PillButton type="submit" disabled={isManualBridging || !manualCosmosAddress || !manualAmount} className="w-full">
                                            {isManualBridging ? (
                                                <>
                                                    <LoadingSpinner size="sm" />
                                                    Bridging...
                                                </>
                                            ) : (
                                                "Bridge to Block52"
                                            )}
                                        </PillButton>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Bridge Sync Status */}
                <Card>
                    <CardHeader
                        title="Bridge Sync Status"
                        subtitle="Ethereum → Block52"
                        actions={
                            <PillButton
                                onClick={handleProcessAllPending}
                                disabled={isProcessingAll || pendingCount === 0 || !cosmosWallet.address}
                                title={pendingCount === 0 ? "No pending deposits" : ""}
                            >
                                {isProcessingAll ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        Processing...
                                    </>
                                ) : (
                                    <>Process All Pending ({pendingCount})</>
                                )}
                            </PillButton>
                        }
                    />
                    <div className="px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                        <div>
                            <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">Total</span>
                            <p className="m-0 text-ink font-semibold tabular-nums">{totalDepositsFound || deposits.length}</p>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">Processed</span>
                            <p className="m-0 text-emerald-400 font-semibold tabular-nums">{processedCount}</p>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">Pending</span>
                            <p className="m-0 text-amber-300 font-semibold tabular-nums">{pendingCount}</p>
                        </div>
                    </div>
                </Card>

                {/* Deposits: controls + table */}
                <Card>
                    <CardHeader
                        title="Deposits"
                        actions={
                            <>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="bridge-items-per-page" className="text-sm text-ink-soft whitespace-nowrap">
                                        Items per page:
                                    </label>
                                    <select
                                        id="bridge-items-per-page"
                                        value={itemsPerPage}
                                        onChange={e => handleItemsPerPageChange(parseInt(e.target.value))}
                                        className={selectClass}
                                    >
                                        <option value="10">10</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-ink-soft whitespace-nowrap">Sort:</span>
                                    <PillButton variant="outline" onClick={handleSortOrderChange}>
                                        {sortOrder === "desc" ? "↓ Newest First" : "↑ Oldest First"}
                                    </PillButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="bridge-filter" className="text-sm text-ink-soft whitespace-nowrap">
                                        Filter:
                                    </label>
                                    <select
                                        id="bridge-filter"
                                        value={filter}
                                        onChange={e => setFilter(e.target.value as any)}
                                        className={selectClass}
                                    >
                                        <option value="all">All</option>
                                        <option value="processed">Processed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                                <PillButton onClick={loadDeposits} disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <LoadingSpinner size="sm" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Refresh"
                                    )}
                                </PillButton>
                            </>
                        }
                    />

                    <div className="overflow-x-auto">
                        <table className={`w-full ${isEmpty(filteredDeposits) ? "" : "min-w-[760px]"}`}>
                            <thead>
                                <tr className="border-b border-line">
                                    <th className={`${thClass} text-left`}>Index</th>
                                    <th className={`${thClass} text-left`}>Recipient</th>
                                    <th className={`${thClass} text-right`}>Amount (USDC)</th>
                                    <th className={`${thClass} text-center`}>Status</th>
                                    <th className={`${thClass} text-center`}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {isEmpty(filteredDeposits) ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                                            {isLoading ? "Loading deposits..." : "No deposits found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeposits.map(deposit => (
                                        <tr key={deposit.index} className="hover:bg-surface-hover transition-colors">
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <span className="text-ink font-mono text-sm">#{deposit.index}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-ink-body font-mono text-xs break-all" title={deposit.recipient}>
                                                        {deposit.recipient}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(deposit.recipient, "Address copied!")}
                                                        aria-label="Copy address"
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
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-right">
                                                <span className="text-ink font-semibold tabular-nums">{deposit.amountFormatted} USDC</span>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-center">
                                                {deposit.status === "loading" && (
                                                    <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-surface-raised text-ink-soft border border-line-strong">
                                                        <LoadingSpinner size="xs" />
                                                        Loading...
                                                    </span>
                                                )}
                                                {deposit.status === "processed" && (
                                                    <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                        Processed
                                                    </span>
                                                )}
                                                {deposit.status === "pending" && (
                                                    <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                                        Pending
                                                    </span>
                                                )}
                                                {deposit.status === "error" && (
                                                    <span
                                                        className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/30 cursor-help"
                                                        title={deposit.errorMessage}
                                                    >
                                                        Error
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-center">
                                                {deposit.status === "pending" || deposit.status === "error" ? (
                                                    <PillButton
                                                        size="sm"
                                                        onClick={() => handleProcessDeposit(deposit.index)}
                                                        disabled={processingIndex === deposit.index || !cosmosWallet.address}
                                                        className="mx-auto"
                                                    >
                                                        {processingIndex === deposit.index ? (
                                                            <>
                                                                <LoadingSpinner size="xs" />
                                                                Processing...
                                                            </>
                                                        ) : (
                                                            "Process"
                                                        )}
                                                    </PillButton>
                                                ) : (
                                                    <span className="text-ink-muted text-sm">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="px-5 py-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-ink-muted text-sm">
                            Page {currentPage} of {totalPages > 0 ? totalPages : 1} • Showing deposits {(currentPage - 1) * itemsPerPage} -{" "}
                            {Math.min(currentPage * itemsPerPage, totalDepositsFound > 0 ? totalDepositsFound : totalDeposits)}
                            {totalDepositsFound > 0 && ` of ${totalDepositsFound}`}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setCurrentPage(1)} disabled={!hasPrevPage || isLoading} className={pagerClass} title="First page">
                                ««
                            </button>
                            <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={!hasPrevPage || isLoading} className={pagerClass}>
                                Previous
                            </button>
                            <button type="button" onClick={() => setCurrentPage(p => p + 1)} disabled={!hasNextPage || isLoading} className={pagerClass}>
                                Next
                            </button>
                            <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={!hasNextPage || isLoading} className={pagerClass} title="Last page">
                                »»
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Info Box */}
                <div className={`${noticeClass.info} !p-4`}>
                    <h3 className="m-0 mb-2 text-sm font-semibold text-ink">How This Works</h3>
                    <ul className="m-0 text-sm space-y-1 list-disc list-inside text-ink-soft">
                        <li>This dashboard queries the Ethereum bridge contract for all deposit events</li>
                        <li>Each deposit shows the Cosmos recipient address and USDC amount</li>
                        <li>Status indicates whether the deposit has been processed on Block52 chain</li>
                        <li>Click "Process" to mint USDC on Block52 for pending deposits</li>
                        <li>Processed deposits cannot be processed again (idempotency protection)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
