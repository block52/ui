import { useState, useEffect } from "react";
import { usePaymentApi } from "../../../context/PaymentApiContext";
import spinner from "../../../assets/spinning-circles.svg";
import { DEPOSIT_CURRENCIES } from "../../../config/depositCurrencies";
import styles from "./CurrencySelector.module.css";

import type { CurrencySelectorProps } from "../types";

/**
 * The crypto-deposit currency picker: exactly the options in
 * {@link DEPOSIT_CURRENCIES} (BTC, ETH, USDT, USDC), no "more options" list.
 *
 * The proxy is pinged once on mount purely as a reachability check so a dead
 * payment service is surfaced before the user types an amount; the list it
 * returns is not used (it is empty in production today).
 */
const CurrencySelector: React.FC<CurrencySelectorProps> = ({ selectedCurrency, onCurrencySelect }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const paymentApi = usePaymentApi();

    useEffect(() => {
        let cancelled = false;
        const checkPaymentService = async () => {
            try {
                setLoading(true);
                const response = (await paymentApi.getCurrencies()) as { success?: boolean };

                if (!cancelled && !response.success) {
                    setError("Failed to load currencies");
                }
            } catch (err) {
                console.error("Error fetching currencies:", err);
                if (!cancelled) {
                    setError("Could not connect to payment service");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        checkPaymentService();
        return () => {
            cancelled = true;
        };
    }, [paymentApi]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <img src={spinner} className="w-8 h-8" alt="loading" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/50 text-red-400 text-sm">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-400">
                Select the Crypto Currency to deposit
            </label>

            {/* Currency Grid */}
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Deposit currency">
                {DEPOSIT_CURRENCIES.map(currency => {
                    const selected = selectedCurrency === currency.code;
                    return (
                        <button
                            key={currency.code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onCurrencySelect(currency.code)}
                            className={`p-3 rounded-lg border transition-all ${
                                selected ? `border-blue-500 bg-blue-900/30 ${styles.selectedCurrency}` : "border-gray-600 bg-gray-900 hover:border-gray-500"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <img src={currency.logo} alt="" className="w-8 h-8 rounded-full" />
                                <div className="text-left flex-1 min-w-0">
                                    <div className="text-white font-semibold uppercase text-sm">{currency.symbol}</div>
                                    <div className="text-gray-400 text-xs truncate">{currency.name}</div>
                                    <div className="text-gray-500 text-[10px] truncate">{currency.network}</div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CurrencySelector;
