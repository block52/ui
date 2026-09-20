import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PaymentDisplayProps } from "../types";
import { toSmallestUnit, ethToWei } from "../../../utils/currencyUtils";
import { useCopyToClipboard } from "../../../hooks/useCopyToClipboard";
import styles from "./PaymentDisplay.module.css";
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

    return (
        <div className="space-y-4">
            {/* Payment Info Header */}
            <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
                <div className="text-center">
                    <p className="text-gray-400 text-sm mb-1">Send Exactly</p>
                    <p className="text-2xl font-bold text-white">
                        {payAmount} <span className="text-lg">{displayName}</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1">{"\u2248"} ${priceAmount.toFixed(2)} USD</p>
                </div>
            </div>

            {/* Network Warning Banner */}
            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-500/50 flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div className="flex-1">
                        <p className="text-blue-400 text-sm font-semibold">
                            Network: {networkName}
                        </p>
                        <p className="text-blue-400/70 text-xs mt-1">
                            Only send {displayName} on the <strong>{networkName}</strong> network. Sending on the wrong network will result in lost funds.
                        </p>
                    </div>
                </div>

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white rounded-lg">
                <QRCodeSVG
                    value={qrValue}
                    size={200}
                    level="H"
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                />
            </div>

            {/* Payment Address */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">Payment Address</label>
                <div className="relative">
                    <input
                        type="text"
                        value={paymentAddress}
                        readOnly
                        className="w-full p-3 pr-20 border border-gray-600 bg-gray-900 text-white rounded-lg font-mono text-sm"
                    />
                    <button
                        onClick={() => copy(paymentAddress, "Address copied to clipboard!")}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded text-xs font-semibold transition-all text-white ${
                            copied ? styles.copyButtonCopied : styles.copyButtonDefault
                        }`}
                    >
                        {copied ? "✓ Copied" : "Copy"}
                    </button>
                </div>
            </div>

            {/* Expiration Warning */}
            <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-500/50 flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                    />
                </svg>
                <div className="flex-1">
                    <p className="text-yellow-400 text-sm font-semibold">Payment Expires In: {formatExpiration(expiresAt)}</p>
                    <p className="text-yellow-400/80 text-xs mt-1">
                        Send the exact amount to avoid payment failures. Partial payments may be lost.
                    </p>
                </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-sm text-gray-400">
                <p className="font-semibold text-white">How to complete payment:</p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                    <li>Open your crypto wallet</li>
                    <li>Scan the QR code or copy the address above</li>
                    <li>
                        Send exactly {payAmount} {displayName} on the <strong className="text-white">{networkName}</strong> network
                    </li>
                    <li>Wait for blockchain confirmation (5-15 minutes)</li>
                    <li>Your USDC will appear in your game wallet automatically</li>
                </ol>
            </div>
        </div>
    );
};

export default PaymentDisplay;
