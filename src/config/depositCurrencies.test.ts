import { DEFAULT_DEPOSIT_CURRENCY, DEPOSIT_CURRENCIES, USDC_ERC20_CONTRACT, USDT_ERC20_CONTRACT, findDepositCurrency } from "./depositCurrencies";
import { ETH_USDC_ADDRESS, ETH_USDT_ADDRESS } from "./constants";

describe("DEPOSIT_CURRENCIES", () => {
    it("is exactly BTC, ETH, USDT and USDC, in that order", () => {
        expect(DEPOSIT_CURRENCIES.map(c => c.symbol)).toEqual(["BTC", "ETH", "USDT", "USDC"]);
    });

    it("uses NOWPayments tickers: network-suffixed USDT, plain usdc for USDC on Ethereum", () => {
        expect(DEPOSIT_CURRENCIES.map(c => c.code)).toEqual(["btc", "eth", "usdterc20", "usdc"]);
        // "usdcerc20" is not a NOWPayments ticker (the proxy's own outcome currency is "usdc").
        expect(DEPOSIT_CURRENCIES.some(c => c.code === "usdcerc20")).toBe(false);
    });

    it("has lowercase, unique codes and an image logo and network for every option", () => {
        const codes = DEPOSIT_CURRENCIES.map(c => c.code);
        expect(new Set(codes).size).toBe(codes.length);
        for (const currency of DEPOSIT_CURRENCIES) {
            expect(currency.code).toBe(currency.code.toLowerCase());
            expect(currency.logo).toBeTruthy();
            expect(currency.network).toBeTruthy();
        }
    });

    it("carries the mainnet contract and 6 decimals for the two ERC-20 stablecoins only", () => {
        const byCode = Object.fromEntries(DEPOSIT_CURRENCIES.map(c => [c.code, c]));
        expect(byCode.usdterc20.erc20).toEqual({ contract: ETH_USDT_ADDRESS, decimals: 6 });
        expect(byCode.usdc.erc20).toEqual({ contract: ETH_USDC_ADDRESS, decimals: 6 });
        expect(USDT_ERC20_CONTRACT).toBe(ETH_USDT_ADDRESS);
        expect(USDC_ERC20_CONTRACT).toBe(ETH_USDC_ADDRESS);
        expect(byCode.btc.erc20).toBeUndefined();
        expect(byCode.eth.erc20).toBeUndefined();
    });

    it("defaults to BTC", () => {
        expect(DEFAULT_DEPOSIT_CURRENCY).toBe("btc");
    });
});

describe("findDepositCurrency", () => {
    it("matches case-insensitively (NOWPayments echoes pay_currency in either case)", () => {
        expect(findDepositCurrency("USDC")?.code).toBe("usdc");
        expect(findDepositCurrency("UsdTerc20")?.symbol).toBe("USDT");
    });

    it("returns undefined for a currency we do not offer", () => {
        expect(findDepositCurrency("sol")).toBeUndefined();
        expect(findDepositCurrency("usdcerc20")).toBeUndefined();
        expect(findDepositCurrency("")).toBeUndefined();
    });
});
