/**
 * Display helpers for one row of the lobby's Recent Transactions list.
 */

import { formatMicroAsUsdc } from "../constants/currency";
import { hasContent } from "./guards";

/** Money flow of a transaction relative to the wallet. */
export type TransactionFlow = "in" | "out" | "neutral";

export interface TransactionFlowInput {
    transferDirection?: "sent" | "received";
    /** Poker action / derived action ("join", "create", "leave", "call", ...). */
    action?: string;
}

/**
 * Incoming when USDC was received, outgoing when sent (or a buy-in / table
 * creation, which always debit the wallet), otherwise neutral.
 */
export const transactionFlow = ({ transferDirection, action }: TransactionFlowInput): TransactionFlow => {
    if (transferDirection === "received") return "in";
    if (transferDirection === "sent") return "out";
    if (action === "join" || action === "create") return "out";
    return "neutral";
};

/** "+$2.40" in, "−$2.00" out, "$0.10" neutral. Amount is micro-USDC. */
export const formatSignedUsdc = (microAmount: string, flow: TransactionFlow): string => {
    const value = `$${formatMicroAsUsdc(microAmount, 2)}`;
    if (flow === "in") return `+${value}`;
    if (flow === "out") return `−${value}`;
    return value;
};

/** Secondary line: the parts that exist, joined by " · ". */
export const joinDetail = (...parts: ReadonlyArray<string | undefined>): string => parts.filter(hasContent).join(" · ");
