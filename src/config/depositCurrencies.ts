import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import usdcLogo from "../assets/crypto/usdc.svg";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "./constants";

/**
 * The crypto deposit options offered through the NOWPayments flow — exactly
 * these four, in this order (BTC, ETH, USDT, USDC).
 *
 * `code` is the NOWPayments pay-currency ticker: it is what the proxy's
 * `/api/nowpayments/create` receives and what comes back as `pay_currency`.
 * Tickers are network-specific — USDT on Ethereum is `usdterc20`, while USDC
 * on Ethereum is plain `usdc` (there is no `usdcerc20`; `usdc` is also the
 * outcome currency the proxy converts every deposit into).
 *
 * The proxy's `/currencies` endpoint is NOT the source of this list: it returns
 * an empty list in production today, and the set we offer is a product
 * decision. `CurrencySelector` only pings it as a reachability check.
 */
export interface DepositCurrency {
    /** NOWPayments ticker, lowercase. */
    code: string;
    /** Shown on the tile and in the payment display. */
    symbol: string;
    name: string;
    network: string;
    /** Bundled SVG url. */
    logo: string;
    /** Set for ERC-20 tokens: the payment QR becomes an EIP-681 token transfer on this contract. */
    erc20?: { contract: string; decimals: number };
}

export const USDT_ERC20_CONTRACT = ETH_USDT_ADDRESS;
export const USDC_ERC20_CONTRACT = ETH_USDC_ADDRESS;

export const DEPOSIT_CURRENCIES: readonly DepositCurrency[] = [
    { code: "btc", symbol: "BTC", name: "Bitcoin", network: "Bitcoin Network", logo: btcLogo },
    { code: "eth", symbol: "ETH", name: "Ethereum", network: "Ethereum Network", logo: ethLogo },
    { code: "usdterc20", symbol: "USDT", name: "Tether", network: "Ethereum (ERC-20)", logo: usdtLogo, erc20: { contract: USDT_ERC20_CONTRACT, decimals: 6 } },
    { code: "usdc", symbol: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)", logo: usdcLogo, erc20: { contract: USDC_ERC20_CONTRACT, decimals: 6 } }
];

/** The option pre-selected when the deposit modal opens. */
export const DEFAULT_DEPOSIT_CURRENCY = DEPOSIT_CURRENCIES[0].code;

/**
 * Look up an offered currency by ticker, case-insensitively (NOWPayments echoes
 * `pay_currency` in either case). Undefined for anything we do not offer.
 */
export function findDepositCurrency(code: string): DepositCurrency | undefined {
    const key = code.toLowerCase();
    return DEPOSIT_CURRENCIES.find(currency => currency.code === key);
}
