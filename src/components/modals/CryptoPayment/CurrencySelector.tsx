import { useState, useEffect } from "react";
import axios from "axios";
import { PROXY_URL } from "../../../config/constants";
import spinner from "../../../assets/spinning-circles.svg";
import btcLogo from "../../../assets/crypto/btc.svg";
import usdcLogo from "../../../assets/crypto/usdc.svg";
import usdtLogo from "../../../assets/crypto/usdt.svg";
import styles from "./CurrencySelector.module.css";

interface Currency {
    symbol: string;
    displaySymbol: string;
    name: string;
    network: string;
    logo: string;
    logoType: "image" | "text";
}

import type { CurrencySelectorProps } from "../types";

const POPULAR_CURRENCIES: Currency[] = [
    { symbol: "btc", displaySymbol: "BTC", name: "Bitcoin", network: "Bitcoin Network", logo: btcLogo, logoType: "image" },
    { symbol: "usdterc20", displaySymbol: "USDT", name: "Tether", network: "Ethereum (ERC-20)", logo: usdtLogo, logoType: "image" },
];

const MORE_CURRENCIES: Currency[] = [
    { symbol: "eth", displaySymbol: "ETH", name: "Ethereum", network: "Ethereum Network", logo: "Ξ", logoType: "text" },
    { symbol: "usdterc20", displaySymbol: "USDT", name: "Tether", network: "Ethereum (ERC-20)", logo: usdtLogo, logoType: "image" },
    { symbol: "usdttrc20", displaySymbol: "USDT", name: "Tether", network: "Tron (TRC-20)", logo: usdtLogo, logoType: "image" },
    { symbol: "sol", displaySymbol: "SOL", name: "Solana", network: "Solana Network", logo: "SOL", logoType: "text" },
    { symbol: "trx", displaySymbol: "TRX", name: "Tron", network: "Tron Network", logo: "TRX", logoType: "text" },
    { symbol: "maticpolygon", displaySymbol: "MATIC", name: "Polygon", network: "Polygon Network", logo: "MATIC", logoType: "text" },
    { symbol: "ltc", displaySymbol: "LTC", name: "Litecoin", network: "Litecoin Network", logo: "Ł", logoType: "text" },
    { symbol: "doge", displaySymbol: "DOGE", name: "Dogecoin", network: "Dogecoin Network", logo: "Ð", logoType: "text" },
    { symbol: "bnbbsc", displaySymbol: "BNB", name: "BNB", network: "BNB Smart Chain (BSC)", logo: "BNB", logoType: "text" },
    { symbol: "ada", displaySymbol: "ADA", name: "Cardano", network: "Cardano Network", logo: "₳", logoType: "text" },
    { symbol: "xrp", displaySymbol: "XRP", name: "XRP", network: "XRP Ledger", logo: "XRP", logoType: "text" },
];

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ selectedCurrency, onCurrencySelect }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showMore, setShowMore] = useState(false);

    useEffect(() => {
        fetchCurrencies();
    }, []);

    const fetchCurrencies = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${PROXY_URL}/api/nowpayments/currencies`);

            if (!response.data.success) {
                setError("Failed to load currencies");
            }
        } catch (err) {
            console.error("Error fetching currencies:", err);
            setError("Could not connect to payment service");
        } finally {
            setLoading(false);
        }
    };

    const displayCurrencies = showMore
        ? [...POPULAR_CURRENCIES, ...MORE_CURRENCIES]
        : POPULAR_CURRENCIES;

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
            <div className="grid grid-cols-2 gap-3">
                {displayCurrencies.map((currency) => (
                    <button
                        key={currency.symbol}
                        onClick={() => onCurrencySelect(currency.symbol)}
                        className={`p-3 rounded-lg border transition-all ${selectedCurrency === currency.symbol
                                ? `border-blue-500 bg-blue-900/30 ${styles.selectedCurrency}`
                                : "border-gray-600 bg-gray-900 hover:border-gray-500"
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {currency.logoType === "image" ? (
                                <img src={currency.logo} alt={currency.displaySymbol} className="w-8 h-8 rounded-full" />
                            ) : (
                                <span className="text-2xl">{currency.logo}</span>
                            )}
                            <div className="text-left flex-1 min-w-0">
                                <div className="text-white font-semibold uppercase text-sm">
                                    {currency.displaySymbol}
                                </div>
                                <div className="text-gray-400 text-xs truncate">{currency.name}</div>
                                <div className="text-gray-500 text-[10px] truncate">{currency.network}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* More Options Toggle */}
            <button
                onClick={() => setShowMore(!showMore)}
                className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors py-1"
            >
                {showMore ? "Show less" : `More options (${MORE_CURRENCIES.length})`}
            </button>
        </div>
    );
};

export default CurrencySelector;
