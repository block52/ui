import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useNetwork } from "../context/NetworkContext";
import { formatTimestampRelative } from "../utils/formatUtils";
import { formatTransactionLabel, formatShortHash, getDisplayableActionAmount, sumUsdcTransferEvents, type TransferEvent } from "../utils/transactionUtils";
import { transactionFlow, formatSignedUsdc, joinDetail, TransactionFlow } from "../utils/transactionRow";
import { tableDisplayName } from "../utils/lobbyTables";
import { Card } from "./ui";
import { useCosmosApi } from "../context/CosmosApiContext";
import { isEmpty, hasElements } from "../utils/guards";

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
    /** Opens the deposit flow; powers the empty state's "Make your first deposit". */
    onDeposit?: () => void;
}

const ghostIconClass =
    "w-11 h-11 lg:w-9 lg:h-9 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light";

/** Round icon tone: green in, red failed, neutral otherwise. */
const iconToneClass = (flow: TransactionFlow, failed: boolean): string => {
    if (failed) return "bg-red-400/15 text-red-400";
    if (flow === "in") return "bg-emerald-400/15 text-emerald-400";
    return "bg-surface-hover text-ink-body";
};

/** Arrow into the wallet (down-left) or out of it (up-right). */
const FlowIcon: React.FC<{ incoming: boolean }> = ({ incoming }) => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {incoming ? (
            <>
                <path d="M17 7 7 17" />
                <path d="M17 17H7V7" />
            </>
        ) : (
            <>
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
            </>
        )}
    </svg>
);

/** A coin amount as the REST gateway serialises it — the value is a string, not a number. */
interface Coin {
    denom: string;
    amount: string;
}

/**
 * One message inside a transaction body.
 *
 * Only `@type` is always present; every other field belongs to a particular
 * message type, so they are optional and narrowed at the use site. `amount` is
 * genuinely two shapes: a scalar on MsgPerformAction, a coin array on MsgSend.
 */
interface CosmosTxMessage {
    "@type": string;
    action?: string;
    amount?: string | Coin[];
    game_id?: string;
    buy_in?: string;
    from_address?: string;
}

/** The decoded transaction body, as returned in the parallel `txs` array. */
interface CosmosTx {
    body?: { messages?: CosmosTxMessage[] };
}

/**
 * One element of `tx_responses`.
 *
 * This is the REST gateway's JSON shape, NOT cosmjs-types' `TxResponse`. The
 * gateway emits snake_case and serialises numerics as strings: `height` here is
 * a string we `parseInt`, where cosmjs-types models it as a `bigint` (and
 * `raw_log` as `rawLog`). Importing that type would need a cast at every
 * access, which is how `any` grew here in the first place.
 */
export interface CosmosTxResponse {
    txhash: string;
    height: string;
    timestamp: string;
    code: number;
    events?: TransferEvent[];
}

export interface TransactionResponse {
    pagination: { next_key: string | null; total: string } | null;
    total: string;
    tx_responses: CosmosTxResponse[];
    txs?: CosmosTx[]; // Include txs for message parsing
}

/** A response entry joined to its decoded body from the parallel `txs` array. */
type TxWithBody = CosmosTxResponse & { tx?: CosmosTx };

/**
 * TransactionPanel - Shows recent transactions for the connected wallet
 * Displays the last 6 transactions
 */
const TransactionPanel: React.FC<TransactionPanelProps> = ({ cosmosWalletAddress, usdcBalance, onDeposit }) => {
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
            const sentTxs: TxWithBody[] = (sentResponse.tx_responses || []).map((tx, i) => ({
                ...tx,
                tx: sentResponse.txs?.[i]
            }));
            const receivedTxs: TxWithBody[] = (receivedResponse.tx_responses || []).map((tx, i) => ({
                ...tx,
                tx: receivedResponse.txs?.[i]
            }));

            // Combine and deduplicate transactions by hash
            const allTxs = [...sentTxs, ...receivedTxs];
            const uniqueTxs = Array.from(new Map(allTxs.map(tx => [tx.txhash, tx])).values());

            // Sort by height (descending) and take first 6
            uniqueTxs.sort((a, b) => parseInt(b.height) - parseInt(a.height));
            const recentTxs = uniqueTxs.slice(0, 6);

            // Extract message type and details for display
            const formattedTxs: Transaction[] = recentTxs.map(tx => {
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
                        amount = getDisplayableActionAmount("MsgPerformAction", typeof msg.amount === "string" ? msg.amount : undefined);
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
                        // Bank transfer — MsgSend carries a coin array, not a scalar
                        const coins = Array.isArray(msg.amount) ? msg.amount[0] : undefined;
                        if (coins) {
                            transferAmount = coins.amount;
                            transferDirection = msg.from_address === address ? "sent" : "received";
                        }
                    }
                }

                // Check events for transfer details if not already found
                if (!transferAmount && tx.events) {
                    transferAmount = sumUsdcTransferEvents(tx.events);
                    if (transferAmount) {
                        const transferEvent = tx.events.find(e => e.type === "transfer");
                        const recipientAttr = transferEvent?.attributes?.find(a => a.key === "recipient");
                        transferDirection = recipientAttr?.value === address ? "received" : "sent";
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
        } catch (err: unknown) {
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
        <Card>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pl-5 pr-3 lg:pr-4 pt-3 lg:pt-4 pb-1 lg:pb-2">
                <h2 className="m-0 text-[17px] lg:text-lg font-semibold text-ink">Recent Transactions</h2>
                <button
                    type="button"
                    onClick={fetchTransactions}
                    disabled={loading}
                    className={ghostIconClass}
                    title="Refresh transactions"
                    aria-label="Refresh transactions"
                >
                    <svg
                        className={`w-[18px] h-[18px] ${loading ? "animate-spin" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            {loading && isEmpty(transactions) ? (
                <div aria-busy="true" aria-label="Loading transactions">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3 border-t border-line animate-pulse">
                            <span className="w-[34px] h-[34px] rounded-full bg-surface-hover flex-none" />
                            <span className="flex-1 flex flex-col gap-2">
                                <span className="h-3.5 w-24 rounded bg-surface-hover" />
                                <span className="h-3 w-36 rounded bg-surface-raised" />
                            </span>
                            <span className="h-3.5 w-14 rounded bg-surface-raised" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="px-6 py-6 text-center border-t border-line">
                    <p className="m-0 text-red-400 text-sm">{error}</p>
                    <button type="button" onClick={fetchTransactions} className="mt-2 min-h-11 px-3 text-sm font-medium text-brand-light hover:underline">
                        Try again
                    </button>
                </div>
            ) : isEmpty(transactions) ? (
                <div className="px-6 py-6 flex flex-col items-center gap-2 text-center border-t border-line">
                    <p className="m-0 text-ink-body font-medium">No transactions yet</p>
                    <p className="m-0 text-ink-muted text-sm leading-snug max-w-[260px]">Deposits, buy-ins and payouts will show up here.</p>
                    {onDeposit && (
                        <button type="button" onClick={onDeposit} className="mt-1 min-h-11 px-3 text-sm font-medium text-brand-light hover:underline">
                            Make your first deposit
                        </button>
                    )}
                </div>
            ) : (
                <ul className="m-0 p-0 list-none">
                    {transactions.map(tx => {
                        const failed = tx.code !== 0;
                        const flow = transactionFlow(tx);
                        const label = formatTransactionLabel(tx.action, tx.messageType);
                        const amountMicro = tx.amount || tx.transferAmount;
                        const detail = joinDetail(
                            tx.gameId ? tableDisplayName(tx.gameId) : formatShortHash(tx.txhash, 6, 4),
                            formatTimestampRelative(tx.timestamp)
                        );
                        return (
                            <li key={tx.txhash} className="border-t border-line">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/explorer/tx/${tx.txhash}`)}
                                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-raised transition-colors"
                                >
                                    <span className={`flex-none w-8 h-8 lg:w-[34px] lg:h-[34px] rounded-full grid place-items-center ${iconToneClass(flow, failed)}`}>
                                        <FlowIcon incoming={flow === "in"} />
                                    </span>
                                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                        <span className={`font-medium truncate ${failed ? "text-ink-muted" : "text-ink"}`}>{failed ? `${label} failed` : label}</span>
                                        <span className="text-xs text-ink-muted truncate">{detail}</span>
                                    </span>
                                    {amountMicro && (
                                        <span
                                            className={`flex-none font-semibold tabular-nums ${
                                                failed ? "text-ink-muted line-through" : flow === "in" ? "text-emerald-400" : "text-ink-body"
                                            }`}
                                        >
                                            {formatSignedUsdc(amountMicro, failed ? "neutral" : flow)}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* View All Link */}
            {hasElements(transactions) && (
                <button
                    type="button"
                    onClick={() => navigate(`/explorer/address/${cosmosWalletAddress}`)}
                    className="w-full block px-5 py-3.5 border-t border-line text-left text-sm font-medium text-brand-light hover:bg-surface-raised transition-colors"
                >
                    View all transactions
                </button>
            )}
        </Card>
    );
};

export default TransactionPanel;
