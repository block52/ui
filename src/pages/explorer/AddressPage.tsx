import { useState, useEffect, useCallback } from "react";
import { isNetworkError } from "../../apis/HTTPClient";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { microToUsdc } from "../../constants/currency";
import { Coin } from "./types";
import { formatTimestampRelative } from "../../utils/formatUtils";
import { isEmpty, hasElements } from "../../utils/guards";
import {
    ExplorerEmpty,
    ExplorerError,
    ExplorerLoading,
    ExplorerPage,
    ExplorerPanel,
    ExplorerReloadButton,
    ExplorerSearchInput
} from "../../components/explorer/ExplorerPanel";
import { TransactionResponse } from "../../components/TransactionPanel";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { copyToClipboard } from "../../components/playPage/Table/utils";

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
            } catch (err) {
                const message = err instanceof Error ? err.message : "";
                let errorMessage = "Failed to fetch address data";

                if (message.includes("timeout")) {
                    errorMessage = "Request timeout - network may be slow";
                } else if (isNetworkError(err) || message.includes("ECONNREFUSED")) {
                    errorMessage = `Cannot connect to ${currentNetwork.name}`;
                } else if (message) {
                    errorMessage = message;
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

    // Searching opens that address's URL, so the page (and a shared link) always
    // reflects the viewed address; the URL effect below does the fetch.
    const submitSearch = () => {
        const next = address.trim();
        if (next && next === urlAddress) {
            handleSearch(next);
        } else if (next) {
            navigate(`/explorer/address/${next}`);
        } else {
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

    // Reloads the address being viewed (same icon and place as the other explorer lists).
    const reload = urlAddress ? <ExplorerReloadButton onClick={() => handleSearch(urlAddress)} busy={loading} label="Reload address" /> : null;

    const tabClass = (tab: "balances" | "transactions") =>
        `px-3 py-3.5 text-sm border-b-2 transition-colors ${
            activeTab === tab ? "border-brand text-ink font-semibold" : "border-transparent text-ink-muted font-medium hover:text-ink"
        }`;

    return (
        <ExplorerPage>

                <ExplorerSearchInput value={address} onChange={setAddress} placeholder="Search by address (b52…)" onSubmit={submitSearch} busy={loading} />

                {/* Address header */}
                {urlAddress && (
                    <div className={"px-4 py-3 sm:px-5 sm:py-4 rounded-2xl mb-4 bg-surface-card border border-line"}>
                        <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">Address</p>
                        <div className="flex items-start gap-2">
                            <p className="flex-1 min-w-0 font-mono text-sm sm:text-base text-ink break-all">{urlAddress}</p>
                            <button
                                type="button"
                                onClick={() => copyToClipboard(urlAddress, "Address copied")}
                                title="Copy address"
                                aria-label="Copy address"
                                className={"shrink-0 -m-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-surface-hover transition-colors"}
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
                        <Link to={`/players/${urlAddress}`} className={"inline-flex items-center min-h-11 -mb-2 text-sm text-brand-light hover:underline"}>
                            Player profile →
                        </Link>
                    </div>
                )}

                {/* One results panel for every state: prompt, loading, error, empty, data.
                    Like the other explorer lists, it carries a reload action once there is something to reload. */}
                {!urlAddress ? (
                    <ExplorerPanel header="Address">
                        <ExplorerEmpty>Enter a Block52 address above to see its balances and transactions.</ExplorerEmpty>
                    </ExplorerPanel>
                ) : loading ? (
                    <ExplorerPanel header="Address" action={reload}>
                        <ExplorerLoading label="Loading address…" />
                    </ExplorerPanel>
                ) : error ? (
                    <ExplorerPanel header="Address" action={reload}>
                        <ExplorerError>{error}</ExplorerError>
                    </ExplorerPanel>
                ) : isEmpty(balances) && isEmpty(transactions) ? (
                    <ExplorerPanel header="Address" action={reload}>
                        <ExplorerEmpty>No balances or transactions for this address yet.</ExplorerEmpty>
                    </ExplorerPanel>
                ) : (
                    <ExplorerPanel
                        action={reload}
                        header={
                            <div className="flex gap-2 -mb-px" role="tablist">
                                <button
                                    role="tab"
                                    aria-selected={activeTab === "balances"}
                                    onClick={() => setActiveTab("balances")}
                                    className={tabClass("balances")}
                                >
                                    Balances
                                </button>
                                <button
                                    role="tab"
                                    aria-selected={activeTab === "transactions"}
                                    onClick={() => setActiveTab("transactions")}
                                    className={tabClass("transactions")}
                                >
                                    Transactions{hasElements(transactions) ? ` (${transactions.length})` : ""}
                                </button>
                            </div>
                        }
                    >
                        <div className="p-3 sm:p-4">
                            {/* Balances Tab */}
                            {activeTab === "balances" &&
                                (isEmpty(balances) ? (
                                    <ExplorerEmpty>No balances for this address.</ExplorerEmpty>
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {balances.map((balance, index) => (
                                            <li key={index} className="flex justify-between items-center py-2.5">
                                                <span className="text-sm text-ink-soft">{formatDenom(balance.denom)}</span>
                                                <span className="font-mono text-sm sm:text-base text-ink">{formatAmount(balance.amount, balance.denom)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ))}

                            {/* Transactions Tab */}
                            {activeTab === "transactions" &&
                                (isEmpty(transactions) ? (
                                    <ExplorerEmpty>No transactions for this address.</ExplorerEmpty>
                                ) : (
                                    <ul className="space-y-2">
                                        {transactions.map((tx: any, index) => {
                                            const currentAddress = urlAddress || address;
                                            return (
                                                <li
                                                    key={index}
                                                    onClick={() =>
                                                        navigate(`/explorer/tx/${tx.txhash}`, {
                                                            state: { fromAddress: currentAddress }
                                                        })
                                                    }
                                                    className={"px-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-surface-raised border border-line hover:border-brand/50"}
                                                >
                                                    <div className="flex justify-between items-center gap-3">
                                                        <p className="flex-1 min-w-0 font-mono text-xs sm:text-sm text-ink truncate">{tx.txhash}</p>
                                                        <span
                                                            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${tx.code === 0 ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"}`}
                                                        >
                                                            {tx.code === 0 ? "Success" : "Failed"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                        Block {tx.height} · {formatTimestampRelative(tx.timestamp)}
                                                    </p>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ))}
                        </div>
                    </ExplorerPanel>
                )}
        </ExplorerPage>
    );
}
