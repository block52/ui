import { formatMicroAsUsdc } from "../constants/currency";
import { hasContent } from "./guards";

export type TransactionFlow = "in" | "out" | "neutral";

interface TransactionFlowInput {
    transferDirection?: "sent" | "received";
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

const MICRO_PER_CENT = 10_000;

/** Two decimals, except below a cent, where up to six are kept so a sub-cent amount never reads "$0.00". */
const formatUsdcAmount = (microAmount: string): string => {
    const micro = Number(microAmount);
    if (micro > 0 && micro < MICRO_PER_CENT) {
        return formatMicroAsUsdc(microAmount, 6).replace(/0+$/, "");
    }
    return formatMicroAsUsdc(microAmount, 2);
};

/** "+$2.40" in, "−$2.00" out, "$0.10" neutral. Amount is micro-USDC. */
export const formatSignedUsdc = (microAmount: string, flow: TransactionFlow): string => {
    const value = `$${formatUsdcAmount(microAmount)}`;
    if (flow === "in") return `+${value}`;
    if (flow === "out") return `−${value}`;
    return value;
};

export const joinDetail = (...parts: ReadonlyArray<string | undefined>): string => parts.filter(hasContent).join(" · ");
