import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { microToUsdc } from "../../constants/currency";
import { Coin } from "./types";
import { formatTimestampRelative } from "../../utils/formatUtils";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";
import styles from "./AddressPage.module.css";
import { TransactionResponse } from "../../components/TransactionPanel";
import { useCosmosApi } from "../../context/CosmosApiContext";

export default function AddressPage() {
    const { address: urlAddress } = useParams<{ address: string }>();
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();

    const [address, setAddress] = useState(urlAddress || "");
    const [balances, setBalances] = useState<Coin[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"balances" | "transactions">("balances");
    const cosmosApi = useCosmosApi();

    const handleSearch = useCallback(
        async (addressToSearch?: string) => {
            const searchAddress = addressToSearch || address;

            if (!searchAddress.trim()) {
                setError("Please enter a Block 52 address");
                return;
            }

            // Validate address format (should start with the chain prefix, e.g., "b52")
            if (!searchAddress.startsWith("b52")) {
                setError("Invalid address format. Address should start with 'b52'");
                return;
            }

            try {
                setLoading(true);
                setError(null);
                const cosmosClient = getCosmosClient({
                    rpc: currentNetwork.rpc,
                    rest: currentNetwork.rest
                });

                if (!cosmosClient) {
                    throw new Error("Block52 client not initialized.");
                }

                // Fetch balances
                const addressBalances = await cosmosClient.getAllBalances(searchAddress.trim());
                setBalances(addressBalances);

                // Fetch transactions - try multiple event types to catch all transactions
                try {
                    // Query for transactions where this address is the sender OR recipient
                    const senderQuery = `message.sender='${searchAddress.trim()}'`;
                    const recipientQuery = `transfer.recipient='${searchAddress.trim()}'`;

                    // Fetch both sent and received transactions
                    // Note: Cosmos SDK uses 'query=' parameter, not 'events='
                    const [sentResponse, receivedResponse] = await Promise.all([
                        cosmosApi.getSentTransactions(senderQuery) as Promise<TransactionResponse>,
                        cosmosApi.getReceivedTransactions(recipientQuery) as Promise<TransactionResponse>
                    ]);

                    // Combine and deduplicate transactions by hash
                    const allTxs = [...(sentResponse.tx_responses || []), ...(receivedResponse.tx_responses || [])];
                    const uniqueTxs = Array.from(new Map(allTxs.map((tx: any) => [tx.txhash, tx])).values());

                    // Sort by height (descending)
                    uniqueTxs.sort((a: any, b: any) => parseInt(b.height) - parseInt(a.height));

                    setTransactions(uniqueTxs);
                } catch (txError) {
                    console.error("Error fetching transactions:", txError);
                    // Don't fail the whole query if transactions fail
                    setTransactions([]);
                }
            } catch (err: any) {
                let errorMessage = "Failed to fetch address data";

                if (err.message?.includes("timeout")) {
                    errorMessage = "Request timeout - network may be slow";
                } else if (err.code === "ERR_NETWORK" || err.message?.includes("ECONNREFUSED")) {
                    errorMessage = `Cannot connect to ${currentNetwork.name}`;
                } else if (err.message) {
                    errorMessage = err.message;
                }

                setError(errorMessage);
                setBalances([]);
                setTransactions([]);
                console.error("Error fetching address data:", err);
            } finally {
                setLoading(false);
            }
        },
        [address, currentNetwork]
    );

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // Auto-search if address is in URL
    useEffect(() => {
        if (urlAddress) {
            handleSearch(urlAddress);
        }
    }, [urlAddress, currentNetwork, handleSearch]);

    // Set page title
    useEffect(() => {
        if (urlAddress) {
            const shortAddress = `${urlAddress.substring(0, 10)}...${urlAddress.substring(urlAddress.length - 6)}`;
            document.title = `Address ${shortAddress} - Block52 Explorer`;
        } else {
            document.title = "Address Search - Block52 Explorer";
        }

        return () => {
            document.title = "Block52 Chain";
        };
    }, [urlAddress]);

    const formatDenom = (denom: string) => {
        if (denom.toLowerCase() === "usdc") return "USDC";
        if (denom.startsWith("u")) return denom.slice(1).toUpperCase();
        return denom.toUpperCase();
    };

    const formatAmount = (amount: string, denom: string) => {
        // Assuming micro-denominations (6 decimals)
        const value = microToUsdc(amount);
        return `${value.toFixed(6)} ${formatDenom(denom)}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                alert("Copied to clipboard!");
            })
            .catch(err => {
                console.error("Failed to copy:", err);
                alert("Failed to copy address");
            });
    };

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Explorer Navigation Header */}
                <ExplorerHeader title="Block Explorer" />

                {/* Search Card */}
                <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Enter Block 52 address (e.g., b521234...)"
                                className={`flex-1 px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${styles.searchInput}`}
                            />
                            {address && (
                                <button
                                    onClick={() => copyToClipboard(address)}
                                    className={`px-4 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 ${styles.copyButton}`}
                                >
                                    Copy
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={loading}
                            className={`w-full px-6 py-3 rounded-lg text-white font-bold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${loading ? styles.searchButtonLoading : styles.searchButtonReady}`}
                        >
                            {loading ? "Searching..." : "Search Address"}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard} ${styles.errorContainer}`}>
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                )}

                {/* Results */}
                {!loading && !error && (balances.length > 0 || transactions.length > 0) && (
                    <>
                        {/* Tabs */}
                        <div className={`backdrop-blur-md p-2 rounded-xl shadow-2xl mb-6 flex gap-2 ${styles.containerCard}`}>
                            <button
                                onClick={() => setActiveTab("balances")}
                                className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all hover:opacity-90 ${activeTab === "balances" ? styles.tabActive : styles.tabInactive}`}
                            >
                                Balances
                            </button>
                            <button
                                onClick={() => setActiveTab("transactions")}
                                className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all hover:opacity-90 ${activeTab === "transactions" ? styles.tabActive : styles.tabInactive}`}
                            >
                                Transactions
                            </button>
                        </div>

                        {/* Balances Tab */}
                        {activeTab === "balances" && (
                            <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                                <h2 className="text-2xl font-bold text-white mb-4">Token Balances</h2>
                                {balances.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">No balances found for this address</p>
                                ) : (
                                    <div className="space-y-3">
                                        {balances.map((balance, index) => (
                                            <div key={index} className={`p-4 rounded-lg ${styles.balanceItemCard}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-white font-bold">{formatDenom(balance.denom)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-gray-400 text-sm">Amount</p>
                                                        <p className="text-white font-bold text-lg">{formatAmount(balance.amount, balance.denom)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transactions Tab */}
                        {activeTab === "transactions" && (
                            <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                                <h2 className="text-2xl font-bold text-white mb-4">Transaction History</h2>
                                {transactions.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">No transactions found for this address</p>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((tx: any, index) => {
                                            const currentAddress = urlAddress || address;
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() =>
                                                        navigate(`/explorer/tx/${tx.txhash}`, {
                                                            state: { fromAddress: currentAddress }
                                                        })
                                                    }
                                                    className={`p-4 rounded-lg cursor-pointer hover:opacity-80 transition-all ${styles.txItemCard}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <p className="text-gray-400 text-sm">Transaction Hash</p>
                                                            <p className="text-white font-mono text-sm break-all">{tx.txhash}</p>
                                                        </div>
                                                        <div
                                                            className={`px-3 py-1 rounded-full text-xs font-bold ml-4 ${tx.code === 0 ? styles.txStatusSuccess : styles.txStatusFailed}`}
                                                        >
                                                            {tx.code === 0 ? "Success" : "Failed"}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-400">Block Height</p>
                                                            <p className="text-white">{tx.height}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-400">Timestamp</p>
                                                            <p className="text-white">{formatTimestampRelative(tx.timestamp)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* No Results */}
                {!loading && !error && balances.length === 0 && transactions.length === 0 && urlAddress && (
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-center">No data found for this address</p>
                    </div>
                )}
            </div>
        </div>
    );
}
