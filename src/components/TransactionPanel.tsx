import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useNetwork } from "../context/NetworkContext";
import { formatTimestampRelative } from "../utils/formatUtils";
import { microToUsdc } from "../constants/currency";
import styles from "./TransactionPanel.module.css";
import { formatTransactionLabel, formatTransferDirection, getTransferDirectionClass, formatShortHash, formatGameId } from "../utils/transactionUtils";
import { useCosmosApi } from "../context/CosmosApiContext";

interface Transaction {
    txhash: string;
    height: string;
    timestamp: string;
    code: number;
    // Message type for display
    messageType?: string;
    // Detailed action info
    action?: string;
    amount?: string;
    gameId?: string;
    // Transfer info
    transferAmount?: string;
    transferDirection?: "sent" | "received";
}

interface TransactionPanelProps {
    cosmosWalletAddress: string | null;
    usdcBalance: string;
}

export interface TransactionResponse {
    pagination: any;
    total: string;
    tx_responses: any[];
    txs?: any[]; // Include txs for message parsing
}

/**
 * TransactionPanel - Shows recent transactions for the connected wallet
 * Displays the last 6 transactions
 */
const TransactionPanel: React.FC<TransactionPanelProps> = ({ cosmosWalletAddress, usdcBalance }) => {
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cosmosApi = useCosmosApi();

    const fetchTransactions = useCallback(async () => {
        if (!cosmosWalletAddress) return;

        try {
            setLoading(true);
            setError(null);

            const address = cosmosWalletAddress;

            // Query for transactions where this address is the sender OR recipient
            const senderQuery = `message.sender='${address}'`;
            const recipientQuery = `transfer.recipient='${address}'`;
            // Fetch both sent and received transactions
            const [sentResponse, receivedResponse] = await Promise.all([
                cosmosApi.getSentTransactions(senderQuery) as Promise<TransactionResponse>,
                cosmosApi.getReceivedTransactions(recipientQuery) as Promise<TransactionResponse>
            ]);

            // Combine tx_responses with their txs for message type extraction
            const sentTxs = (sentResponse.tx_responses || []).map((tx: any, i: number) => ({
                ...tx,
                tx: sentResponse.txs?.[i]
            }));
            const receivedTxs = (receivedResponse.tx_responses || []).map((tx: any, i: number) => ({
                ...tx,
                tx: receivedResponse.txs?.[i]
            }));

            // Combine and deduplicate transactions by hash
            const allTxs = [...sentTxs, ...receivedTxs];
            const uniqueTxs = Array.from(new Map(allTxs.map((tx: any) => [tx.txhash, tx])).values());

            // Sort by height (descending) and take first 6
            uniqueTxs.sort((a: any, b: any) => parseInt(b.height) - parseInt(a.height));
            const recentTxs = uniqueTxs.slice(0, 6);

            // Extract message type and details for display
            const formattedTxs: Transaction[] = recentTxs.map((tx: any) => {
                let messageType = "Transaction";
                let action: string | undefined;
                let amount: string | undefined;
                let gameId: string | undefined;
                let transferAmount: string | undefined;
                let transferDirection: "sent" | "received" | undefined;

                const msg = tx.tx?.body?.messages?.[0];
                if (msg) {
                    const msgType = msg["@type"] || "";
                    // Extract the last part of the type URL
                    const parts = msgType.split(".");
                    messageType = parts[parts.length - 1] || "Transaction";

                    // Extract poker action details
                    if (msgType.includes("MsgPerformAction")) {
                        action = msg.action;
                        if (msg.amount && msg.amount !== "0") {
                            amount = msg.amount;
                        }
                        gameId = msg.game_id;
                    } else if (msgType.includes("MsgJoinGame")) {
                        action = "join";
                        amount = msg.buy_in;
                        gameId = msg.game_id;
                    } else if (msgType.includes("MsgLeaveGame")) {
                        action = "leave";
                        gameId = msg.game_id;
                    } else if (msgType.includes("MsgCreateGame")) {
                        action = "create";
                        gameId = msg.game_id;
                    } else if (msgType.includes("MsgSend")) {
                        // Bank transfer
                        const coins = msg.amount?.[0];
                        if (coins) {
                            transferAmount = coins.amount;
                            transferDirection = msg.from_address === address ? "sent" : "received";
                        }
                    }
                }

                // Check events for transfer details if not already found
                if (!transferAmount && tx.events) {
                    const transferEvent = tx.events.find((e: any) => e.type === "transfer");
                    if (transferEvent) {
                        const amountAttr = transferEvent.attributes?.find((a: any) => a.key === "amount");
                        const recipientAttr = transferEvent.attributes?.find((a: any) => a.key === "recipient");
                        const senderAttr = transferEvent.attributes?.find((a: any) => a.key === "sender");

                        if (amountAttr?.value) {
                            // Parse amount like "120000usdc"
                            const match = amountAttr.value.match(/^(\d+)/);
                            if (match) {
                                transferAmount = match[1];
                                transferDirection = recipientAttr?.value === address ? "received" : "sent";
                            }
                        }
                    }
                }

                return {
                    txhash: tx.txhash,
                    height: tx.height,
                    timestamp: tx.timestamp,
                    code: tx.code,
                    messageType,
                    action,
                    amount,
                    gameId,
                    transferAmount,
                    transferDirection
                };
            });

            setTransactions(formattedTxs);
        } catch (err: any) {
            console.error("Error fetching transactions:", err);
            setError("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    }, [cosmosWalletAddress, currentNetwork.rest]);

    // Fetch transactions on mount and when wallet changes
    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions, cosmosWalletAddress, usdcBalance]);

    // Don't render if no wallet
    if (!cosmosWalletAddress) {
        return null;
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
                <button
                    onClick={fetchTransactions}
                    disabled={loading}
                    className={`p-2 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50 ${styles.refreshButton}`}
                    title="Refresh transactions"
                >
                    <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading && transactions.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <svg className="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                    </div>
                ) : error ? (
                    <div className="text-center py-6">
                        <p className="text-gray-400 text-sm">{error}</p>
                        <button onClick={fetchTransactions} className={`mt-2 text-sm transition-colors hover:opacity-80 ${styles.primaryText}`}>
                            Try again
                        </button>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-6">
                        <svg className="w-10 h-10 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        <p className="text-gray-400 text-sm">No transactions yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map(tx => (
                            <div
                                key={tx.txhash}
                                onClick={() => navigate(`/explorer/tx/${tx.txhash}`)}
                                className="p-3 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-white text-sm font-medium">{formatTransactionLabel(tx.action, tx.messageType)}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${tx.code === 0 ? styles.statusSuccess : styles.statusFailed}`}>
                                        {tx.code === 0 ? "Success" : "Failed"}
                                    </span>
                                </div>
                                {/* Action/Transfer Details */}
                                {(tx.amount || tx.transferAmount) && (
                                    <div className="flex items-center gap-2 mb-1">
                                        {tx.transferDirection && (
                                            <span className={`text-xs ${getTransferDirectionClass(tx.transferDirection)}`}>
                                                {formatTransferDirection(tx.transferDirection)}
                                            </span>
                                        )}
                                        <span className={`text-sm font-medium ${styles.primaryText}`}>
                                            {microToUsdc(tx.amount || tx.transferAmount || "0")} USDC
                                        </span>
                                        {tx.gameId && <span className="text-xs text-gray-500">Game: {formatGameId(tx.gameId)}</span>}
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400 text-xs font-mono">{formatShortHash(tx.txhash)}</span>
                                    <span className="text-gray-500 text-xs">{formatTimestampRelative(tx.timestamp)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* View All Link */}
                {transactions.length > 0 && cosmosWalletAddress && (
                    <button
                        onClick={() => navigate(`/explorer/address/${cosmosWalletAddress}`)}
                        className={`w-full mt-4 text-center text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2 ${styles.primaryText}`}
                    >
                        <span>View All Transactions</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default TransactionPanel;
