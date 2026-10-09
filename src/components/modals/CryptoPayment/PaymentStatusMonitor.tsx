import { useState, useEffect, useCallback, useRef } from "react";
import spinner from "../../../assets/spinning-circles.svg";
import type { PaymentStatusMonitorProps } from "../types";
import { insetBoxClass, noticeClass } from "../walletFormClasses";
import { CheckIcon } from "../walletIcons";
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
    warning: "border-amber-500/30 bg-amber-500/10",
    primary: "border-brand/30 bg-brand/10",
    success: "border-emerald-500/30 bg-emerald-500/10",
    danger: "border-red-500/30 bg-red-500/10"
};

const STATUS_ICON_CLASSES: Record<StatusVariant, string> = {
    warning: "text-amber-300",
    primary: "text-brand-light",
    success: "text-emerald-400",
    danger: "text-red-400"
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
        return (
            <div role="alert" className={noticeClass.error}>
                {error}
            </div>
        );
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

    const steps = [
        { label: "Waiting for blockchain confirmation", active: status.payment_status === "waiting", done: status.payment_status !== "waiting", activeDot: "bg-amber-400" },
        {
            label: "Converting to USDC",
            active: ["confirming", "confirmed"].includes(status.payment_status),
            done: status.payment_status === "sending",
            activeDot: "bg-brand"
        },
        { label: "Depositing to game wallet", active: status.payment_status === "sending", done: false, activeDot: "bg-emerald-400" }
    ];

    return (
        <div className="space-y-4">
            {/* Status Header */}
            {isComplete ? (
                <div role="status" className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 grid place-items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <CheckIcon className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-emerald-400">{statusMessage}</p>
                    <p className="text-xs text-ink-muted mt-2 font-mono break-all">Payment ID: {paymentId}</p>
                </div>
            ) : (
                <div role="status" className={`p-4 rounded-xl border ${STATUS_HEADER_CLASSES[statusVariant]}`}>
                    <div className="flex items-center gap-3">
                        {isProcessing && <img src={spinner} className="w-6 h-6" alt="loading" />}
                        {isFailed && (
                            <svg className={`w-6 h-6 flex-shrink-0 ${STATUS_ICON_CLASSES[statusVariant]}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${STATUS_ICON_CLASSES[statusVariant]}`}>{statusMessage}</p>
                            <p className="text-xs text-ink-muted mt-1 font-mono break-all">Payment ID: {paymentId}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Details */}
            {status.actually_paid && (
                <div className={`space-y-2 ${insetBoxClass}`}>
                    <div className="flex justify-between gap-3 text-sm">
                        <span className="text-ink-muted">Amount Paid</span>
                        <span className="text-ink font-semibold tabular-nums">
                            {status.actually_paid} {status.pay_currency?.toUpperCase()}
                        </span>
                    </div>
                    {status.outcome_amount && (
                        <div className="flex justify-between gap-3 text-sm">
                            <span className="text-ink-muted">USDC Received</span>
                            <span className="text-ink font-semibold tabular-nums">${status.outcome_amount.toFixed(2)} USDC</span>
                        </div>
                    )}
                    {status.bridge_tx_hash && (
                        <div className="pt-2 border-t border-line">
                            <a
                                href={`https://etherscan.io/tx/${status.bridge_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center min-h-11 sm:min-h-0 text-xs font-mono text-brand-light hover:text-ink hover:underline"
                            >
                                View on Etherscan ↗
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Processing Steps */}
            {isProcessing && (
                <ol className={`space-y-2.5 text-sm ${insetBoxClass}`} aria-label="Payment progress">
                    {steps.map(step => (
                        <li key={step.label} className={`flex items-center gap-2.5 ${step.active ? "text-ink" : "text-ink-muted"}`} aria-current={step.active ? "step" : undefined}>
                            {step.done ? (
                                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            ) : (
                                <span className={`w-2 h-2 mx-[3px] rounded-full flex-shrink-0 ${step.active ? `${step.activeDot} animate-pulse` : "bg-line-strong"}`} />
                            )}
                            {step.label}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default PaymentStatusMonitor;
