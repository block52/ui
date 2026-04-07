import { useState, useEffect, useCallback, useRef } from "react";
import spinner from "../../../assets/spinning-circles.svg";
import type { PaymentStatusMonitorProps } from "../types";
import styles from "./PaymentStatusMonitor.module.css";
import { usePaymentApi } from "../../../context/PaymentApiContext";

interface PaymentStatus {
    payment_status: string;
    pay_amount: number;
    pay_currency: string;
    actually_paid?: number;
    outcome_amount?: number;
    outcome_currency?: string;
    bridge_tx_hash?: string;
}

interface PaymentStatusResponse {
    success: boolean;
    payment: {
        payment_id: string;
        payment_status: string;
        pay_address: string;
        pay_amount: number;
        pay_currency: string;
        actually_paid?: number;
        outcome_amount?: number;
        outcome_currency?: string;
        bridge_tx_hash?: string;
        bridge_status?: string;
        expires_at?: string;
        created_at?: string;
        settled_at?: string;
    };
}

const STATUS_MESSAGES = {
    waiting: "Waiting for payment...",
    confirming: "Payment detected! Confirming on blockchain...",
    confirmed: "Payment confirmed! Converting to USDC...",
    sending: "Sending USDC to your wallet...",
    finished: "Complete! USDC deposited to your game wallet.",
    failed: "Payment failed. Please contact support.",
    refunded: "Payment refunded.",
    expired: "Payment expired. Please create a new payment."
};

const STATUS_VARIANTS = {
    waiting: "warning",
    confirming: "primary",
    confirmed: "primary",
    sending: "success",
    finished: "success",
    failed: "danger",
    refunded: "warning",
    expired: "warning"
} as const;

type StatusVariant = (typeof STATUS_VARIANTS)[keyof typeof STATUS_VARIANTS];

const STATUS_HEADER_CLASSES: Record<StatusVariant, string> = {
    warning: styles.statusHeaderWarning,
    primary: styles.statusHeaderPrimary,
    success: styles.statusHeaderSuccess,
    danger: styles.statusHeaderDanger
};

const STATUS_ICON_CLASSES: Record<StatusVariant, string> = {
    warning: styles.statusIconWarning,
    primary: styles.statusIconPrimary,
    success: styles.statusIconSuccess,
    danger: styles.statusIconDanger
};

const TERMINAL_STATUSES = ["finished", "failed", "refunded", "expired"];

const PaymentStatusMonitor: React.FC<PaymentStatusMonitorProps> = ({ paymentId, onPaymentComplete, onStatusChange }) => {
    const [status, setStatus] = useState<PaymentStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const api = usePaymentApi();

    // Use refs for callbacks to prevent effect cascades (infinite re-render loop)
    const onPaymentCompleteRef = useRef(onPaymentComplete);
    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => {
        onPaymentCompleteRef.current = onPaymentComplete;
    }, [onPaymentComplete]);
    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    // Guard: only fire completion callback once
    const completionFiredRef = useRef(false);

    // Track status in ref for interval closure (avoids stale state)
    const statusRef = useRef<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const response = (await api.getPaymentStatus(paymentId)) as PaymentStatusResponse;

            if (response.success) {
                const paymentData = response.payment;
                setStatus(paymentData);
                statusRef.current = paymentData.payment_status;

                // Notify parent of status changes
                onStatusChangeRef.current?.(paymentData.payment_status);

                // If payment is finished, trigger callback exactly once
                if (paymentData.payment_status === "finished" && !completionFiredRef.current) {
                    completionFiredRef.current = true;
                    onPaymentCompleteRef.current?.();
                }
            } else {
                setError("Failed to fetch payment status");
            }
        } catch (err) {
            console.error("Error fetching payment status:", err);
            setError("Could not connect to payment service");
        } finally {
            setLoading(false);
        }
    }, [paymentId]);

    useEffect(() => {
        fetchStatus();

        // Poll every 10 seconds until payment reaches a terminal status
        const interval = setInterval(() => {
            if (!statusRef.current || !TERMINAL_STATUSES.includes(statusRef.current)) {
                fetchStatus();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchStatus]);

    if (loading && !status) {
        return (
            <div className="flex items-center justify-center py-8">
                <img src={spinner} className="w-8 h-8" alt="loading" />
            </div>
        );
    }

    if (error) {
        return <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/50 text-red-400 text-sm">{error}</div>;
    }

    if (!status) return null;

    const statusKey = status.payment_status as keyof typeof STATUS_VARIANTS;

    if (!(statusKey in STATUS_VARIANTS)) {
        throw new Error(`Unknown payment status "${status.payment_status}" — add it to STATUS_VARIANTS in PaymentStatusMonitor.tsx`);
    }

    const statusVariant: StatusVariant = STATUS_VARIANTS[statusKey];
    const statusMessage = STATUS_MESSAGES[statusKey];
    const isComplete = status.payment_status === "finished";
    const isFailed = ["failed", "refunded", "expired"].includes(status.payment_status);
    const isProcessing = ["waiting", "confirming", "confirmed", "sending"].includes(status.payment_status);

    return (
        <div className="space-y-4">
            {/* Status Header */}
            <div className={`p-4 rounded-lg border ${styles.statusHeader} ${STATUS_HEADER_CLASSES[statusVariant]}`}>
                <div className="flex items-center gap-3">
                    {isProcessing && <img src={spinner} className="w-6 h-6" alt="loading" />}
                    {isComplete && (
                        <svg className={`w-6 h-6 ${STATUS_ICON_CLASSES[statusVariant]}`} fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                    )}
                    {isFailed && (
                        <svg className={`w-6 h-6 ${STATUS_ICON_CLASSES[statusVariant]}`} fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                    )}
                    <div className="flex-1">
                        <p className={`font-semibold ${STATUS_ICON_CLASSES[statusVariant]}`}>{statusMessage}</p>
                        <p className="text-xs text-gray-400 mt-1">Payment ID: {paymentId}</p>
                    </div>
                </div>
            </div>

            {/* Payment Details */}
            {status.actually_paid && (
                <div className="p-3 rounded-lg bg-gray-900 border border-gray-700 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Amount Paid</span>
                        <span className="text-white font-semibold">
                            {status.actually_paid} {status.pay_currency?.toUpperCase()}
                        </span>
                    </div>
                    {status.outcome_amount && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">USDC Received</span>
                            <span className="text-white font-semibold">${status.outcome_amount.toFixed(2)} USDC</span>
                        </div>
                    )}
                    {status.bridge_tx_hash && (
                        <div className="pt-2 border-t border-gray-700">
                            <a
                                href={`https://etherscan.io/tx/${status.bridge_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs font-mono hover:underline ${styles.baseScanLink}`}
                            >
                                View on Etherscan ↗
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Processing Steps */}
            {isProcessing && (
                <div className="space-y-2 text-sm">
                    <div className={`flex items-center gap-2 ${status.payment_status === "waiting" ? "text-white" : "text-gray-500"}`}>
                        <div className={`w-2 h-2 rounded-full ${status.payment_status === "waiting" ? "bg-yellow-500 animate-pulse" : "bg-gray-600"}`} />
                        Waiting for blockchain confirmation
                    </div>
                    <div
                        className={`flex items-center gap-2 ${["confirming", "confirmed", "sending"].includes(status.payment_status) ? "text-white" : "text-gray-500"}`}
                    >
                        <div
                            className={`w-2 h-2 rounded-full ${["confirming", "confirmed"].includes(status.payment_status) ? "bg-blue-500 animate-pulse" : status.payment_status === "sending" ? "bg-blue-500" : "bg-gray-600"}`}
                        />
                        Converting to USDC
                    </div>
                    <div className={`flex items-center gap-2 ${status.payment_status === "sending" ? "text-white" : "text-gray-500"}`}>
                        <div className={`w-2 h-2 rounded-full ${status.payment_status === "sending" ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
                        Depositing to game wallet
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentStatusMonitor;
