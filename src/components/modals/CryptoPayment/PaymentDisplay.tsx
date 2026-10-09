import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PaymentDisplayProps } from "../types";
import { toSmallestUnit, ethToWei } from "../../../utils/currencyUtils";
import { useCopyToClipboard } from "../../../hooks/useCopyToClipboard";
import { fieldLabelClass, insetBoxClass, noticeClass } from "../walletFormClasses";
import { CheckIcon, CopyIcon, WarningIcon } from "../walletIcons";
import { findDepositCurrency } from "../../../config/depositCurrencies";

const PaymentDisplay: React.FC<PaymentDisplayProps> = ({
    paymentAddress,
    payAmount,
    payCurrency,
    expiresAt,
    priceAmount
}) => {
    const { copy, copied } = useCopyToClipboard();

    // The offered set (and each option's network + ERC-20 contract) lives in
    // one place; an unknown ticker is a bug upstream, never a guessed network
    // warning (Commandment 7).
    const currency = findDepositCurrency(payCurrency);
    if (!currency) {
        throw new Error(`Unknown deposit currency "${payCurrency}" — the offered set lives in src/config/depositCurrencies.ts`);
    }

    const displayName = currency.symbol;
    const networkName = currency.network;

    const qrValue = useMemo(() => {
        if (currency.erc20) {
            // EIP-681 token transfer: ethereum:<contract>@1/transfer?address=<to>&uint256=<smallest_unit>
            return `ethereum:${currency.erc20.contract}@1/transfer?address=${paymentAddress}&uint256=${toSmallestUnit(payAmount, currency.erc20.decimals)}`;
        }
        switch (currency.code) {
            case "btc":
                // BIP21: bitcoin:<address>?amount=<btc>
                return `bitcoin:${paymentAddress}?amount=${payAmount}`;
            case "eth":
                // EIP-681: ethereum:<address>?value=<wei>
                return `ethereum:${paymentAddress}?value=${ethToWei(payAmount)}`;
            default:
                return paymentAddress;
        }
    }, [currency, paymentAddress, payAmount]);

    const formatExpiration = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins <= 0) return "Expired";
        if (diffMins < 60) return `${diffMins} minutes`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    const expiresIn = formatExpiration(expiresAt);

    return (
        <div className="space-y-4">
            {/* Payment facts */}
            <div className={`${insetBoxClass} text-center py-4`}>
                <p className="text-xs uppercase tracking-[0.08em] text-ink-muted mb-1.5">Send exactly</p>
                <p className="text-[32px] leading-tight font-semibold text-ink tabular-nums break-all">
                    {payAmount} <span className="text-lg text-ink-soft">{displayName}</span>
                </p>
                <p className="text-ink-muted text-xs mt-1 tabular-nums">{"\u2248"} ${priceAmount.toFixed(2)} USD</p>
            </div>
            <div className={`${insetBoxClass} space-y-2`}>
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">Network</span>
                    <span className="text-ink font-semibold">{networkName}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">Payment expires in</span>
                    <span
                        className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold tabular-nums ${
                            expiresIn === "Expired" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                    >
                        {expiresIn}
                    </span>
                </div>
            </div>

            {/* Network Warning */}
            <div className={`flex items-start gap-2 ${noticeClass.warning}`}>
                <WarningIcon className="w-4 h-4 flex-shrink-0 mt-px" />
                <p>
                    Only send {displayName} on the <strong className="text-amber-200">{networkName}</strong> network. Sending on the wrong network will result in lost funds. Send the exact
                    amount to avoid payment failures. Partial payments may be lost.
                </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
                <div className="p-2 bg-white rounded-xl">
                    <QRCodeSVG value={qrValue} size={184} level="H" includeMargin={true} fgColor="#000000" bgColor="#FFFFFF" />
                </div>
            </div>

            {/* Payment Address */}
            <div>
                <span className={fieldLabelClass}>Payment address</span>
                <div className={`flex items-center gap-2 pr-1.5 ${insetBoxClass}`}>
                    <p className="flex-1 min-w-0 m-0 font-mono text-sm text-ink break-all">{paymentAddress}</p>
                    <button
                        type="button"
                        onClick={() => copy(paymentAddress, "Address copied to clipboard!")}
                        aria-label={copied ? "Address copied" : "Copy payment address"}
                        className={`shrink-0 w-11 h-11 grid place-items-center rounded-full transition-colors hover:bg-surface-hover ${copied ? "text-emerald-400" : "text-ink-muted hover:text-ink"}`}
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <details className="group rounded-xl border border-line bg-surface-raised">
                <summary className="flex items-center justify-between min-h-11 px-4 cursor-pointer list-none text-sm font-medium text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
                    How to complete payment
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                    </svg>
                </summary>
                <ol className="list-decimal list-inside space-y-1 px-4 pb-3 text-sm text-ink-soft">
                    <li>Open your crypto wallet</li>
                    <li>Scan the QR code or copy the address above</li>
                    <li>
                        Send exactly {payAmount} {displayName} on the <strong className="text-ink">{networkName}</strong> network
                    </li>
                    <li>Wait for blockchain confirmation (5-15 minutes)</li>
                    <li>Your USDC will appear in your game wallet automatically</li>
                </ol>
            </details>
        </div>
    );
};

export default PaymentDisplay;
