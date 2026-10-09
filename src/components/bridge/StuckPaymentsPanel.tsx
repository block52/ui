import { useState, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { usePaymentApi } from "../../context/PaymentApiContext";
import { proxyErrorMessage, isProxyTimeout, STILL_GOING_THROUGH } from "../../utils/bridge/proxyError";
import { LoadingSpinner } from "../common/LoadingSpinner";

/** One payment NOWPayments settled whose USDC has not all reached the bridge (proxy GET /unbridged). */
export interface UnbridgedPaymentDTO {
    payment_id: string;
    cosmos_address: string;
    payment_status: string;
    pay_currency: string;
    pay_amount: number;
    actually_paid: number;
    price_amount: number;
    outcome_amount: number;
    bridged_amount: string;
    outstanding_amount: string;
    bridge_status: string | null;
    bridge_tx_hash: string | null;
    created_at: string;
}

interface UnbridgedResponseDTO {
    success: boolean;
    count: number;
    total_outstanding: string;
    payments: UnbridgedPaymentDTO[];
}

interface RetryResponseDTO {
    success: boolean;
    txHash: string;
    status: string;
}

interface StuckPaymentsPanelProps {
    adminKey: string;
    /** Hot wallet USDC balance, to warn when the list owes more than the wallet holds. */
    hotWalletUsdc: string | null;
    /** Called after a retry sends funds, so the page can refresh the wallet and deposit list. */
    onBridged: () => void;
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Players who paid through NOWPayments but were never credited on Block52, with a
 * Retry button that bridges what each payment still owes to the address on its own
 * record (proxy POST /retry-bridge/:paymentId). Nothing is typed, so nothing can be
 * typed wrong, and the proxy records it so a payment is never paid twice.
 * "Mark paid" records one that was already sent by hand (manual bridge).
 */
export function StuckPaymentsPanel({ adminKey, hotWalletUsdc, onBridged }: StuckPaymentsPanelProps) {
    const paymentApi = usePaymentApi();
    const [payments, setPayments] = useState<UnbridgedPaymentDTO[] | null>(null);
    const [totalOwed, setTotalOwed] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [markTxHash, setMarkTxHash] = useState("");

    const load = useCallback(async () => {
        if (!adminKey) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const res = (await paymentApi.getUnbridgedPayments(adminKey)) as UnbridgedResponseDTO;
            setPayments(res.payments);
            setTotalOwed(res.total_outstanding);
        } catch (err) {
            console.error("Failed to load unbridged payments:", err);
            setPayments(null);
            setLoadError(proxyErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [adminKey, paymentApi]);

    useEffect(() => {
        load();
    }, [load]);

    const handleRetry = async (p: UnbridgedPaymentDTO) => {
        setBusyId(p.payment_id);
        setConfirmingId(null);
        try {
            const res = (await paymentApi.retryBridge(p.payment_id, adminKey)) as RetryResponseDTO;
            toast.success(`Sent ${p.outstanding_amount} USDC to the bridge for payment ${p.payment_id}. TX ${res.txHash.slice(0, 10)}…`);
            onBridged();
        } catch (err) {
            console.error("Retry bridge failed:", err);
            if (isProxyTimeout(err)) {
                toast.warning(`Payment ${p.payment_id}: ${STILL_GOING_THROUGH}`);
            } else {
                toast.error(`Not sent: ${proxyErrorMessage(err)}`);
            }
        } finally {
            setBusyId(null);
            load();
        }
    };

    const handleMarkPaid = async (p: UnbridgedPaymentDTO) => {
        if (!TX_HASH_RE.test(markTxHash.trim())) {
            toast.error("Paste the 0x… Ethereum transaction hash of the bridge deposit you sent by hand");
            return;
        }
        setBusyId(p.payment_id);
        try {
            await paymentApi.markBridged(p.payment_id, markTxHash.trim(), adminKey);
            toast.success(`Payment ${p.payment_id} recorded as paid`);
            setMarkingId(null);
            setMarkTxHash("");
        } catch (err) {
            console.error("Mark bridged failed:", err);
            toast.error(`Not recorded: ${proxyErrorMessage(err)}`);
        } finally {
            setBusyId(null);
            load();
        }
    };

    const owesMoreThanWallet = totalOwed !== null && hotWalletUsdc !== null && parseFloat(totalOwed) > parseFloat(hotWalletUsdc);

    return (
        <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg mb-6 border border-red-700 p-4" data-testid="stuck-payments">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">⏳</span> Paid but not credited
                    {payments && (
                        <span className="text-base font-normal text-gray-300">
                            ({payments.length} {payments.length === 1 ? "payment" : "payments"}
                            {totalOwed ? `, ${totalOwed} USDC owed` : ""})
                        </span>
                    )}
                </h3>
                <button
                    onClick={load}
                    disabled={isLoading || !adminKey}
                    title="Reload the list from the payments server. Reads only."
                    className="min-h-[44px] px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg text-white text-base"
                >
                    {isLoading ? "Loading…" : "Refresh list"}
                </button>
            </div>

            <p className="text-gray-300 text-base mb-3">
                Players whose payment NOWPayments settled into the hot wallet, but whose USDC never reached the bridge. Retry sends what each payment still owes
                to the address on its own record.
            </p>

            {!adminKey && <p className="text-yellow-300 text-base">Enter the admin key above to see this list.</p>}

            {adminKey && isLoading && payments === null && (
                <div className="flex items-center gap-2 text-gray-300 text-base">
                    <LoadingSpinner size="sm" /> Loading…
                </div>
            )}

            {adminKey && loadError && (
                <p className="text-red-300 text-base" role="alert">
                    Couldn’t load the list: {loadError}
                </p>
            )}

            {owesMoreThanWallet && (
                <p className="text-yellow-300 text-base mb-3" role="alert">
                    ⚠️ The list owes {totalOwed} USDC but the hot wallet holds {hotWalletUsdc}. Some of these may already have been paid by hand — check before
                    retrying, and use “Mark paid” for those.
                </p>
            )}

            {payments && payments.length === 0 && !loadError && (
                <p className="text-green-300 text-base">✅ Nobody is waiting. Every settled payment has been bridged.</p>
            )}

            {payments && payments.length > 0 && (
                <ul className="space-y-3">
                    {payments.map(p => (
                        <li key={p.payment_id} className="bg-gray-900/60 rounded-lg p-3" data-testid={`stuck-${p.payment_id}`}>
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0 flex-1 text-base text-gray-200 space-y-1">
                                    <div>
                                        <span className="text-white font-semibold text-lg">{p.outstanding_amount} USDC owed</span>
                                        <span className="text-gray-400"> · {new Date(p.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="font-mono text-sm break-all text-gray-300">{p.cosmos_address}</div>
                                    <div className="text-gray-400 text-sm">
                                        Payment {p.payment_id} · {p.payment_status === "partially_paid" ? "underpaid" : p.payment_status}: paid{" "}
                                        {p.actually_paid} of {p.pay_amount} {p.pay_currency.toUpperCase()} for ${p.price_amount}
                                        {p.bridge_status ? ` · last bridge attempt: ${p.bridge_status}` : ""}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    {confirmingId === p.payment_id ? (
                                        <>
                                            <button
                                                onClick={() => handleRetry(p)}
                                                disabled={busyId !== null}
                                                title="Sends USDC from the hot wallet to the bridge for this player. Moves real money."
                                                className="min-h-[44px] px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg text-base"
                                            >
                                                Send {p.outstanding_amount} USDC
                                            </button>
                                            <button
                                                onClick={() => setConfirmingId(null)}
                                                title="Don't send anything"
                                                className="min-h-[44px] px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-base"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setConfirmingId(p.payment_id)}
                                                disabled={busyId !== null}
                                                title="Bridge what this payment still owes, to the player's address on record. Asks you to confirm first."
                                                className="min-h-[44px] px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg text-base flex items-center gap-2"
                                            >
                                                {busyId === p.payment_id ? <LoadingSpinner size="sm" /> : null}
                                                Retry
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setMarkingId(markingId === p.payment_id ? null : p.payment_id);
                                                    setMarkTxHash("");
                                                }}
                                                disabled={busyId !== null}
                                                title="Already sent by hand? Record its transaction hash so this payment can never be paid twice. Moves no money."
                                                className="min-h-[44px] px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg text-base"
                                            >
                                                Mark paid
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {markingId === p.payment_id && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <input
                                        type="text"
                                        value={markTxHash}
                                        onChange={e => setMarkTxHash(e.target.value)}
                                        placeholder="0x… transaction hash of the deposit you sent"
                                        aria-label="Bridge deposit transaction hash"
                                        className="min-h-[44px] flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-base font-mono"
                                    />
                                    <button
                                        onClick={() => handleMarkPaid(p)}
                                        disabled={busyId !== null}
                                        title="Records this payment as paid. Moves no money."
                                        className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-base"
                                    >
                                        Save
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
