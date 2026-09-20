import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CurrencySelector from "./CurrencySelector";
import { usePaymentApi } from "../../../context/PaymentApiContext";
import { DEPOSIT_CURRENCIES } from "../../../config/depositCurrencies";

jest.mock("../../../context/PaymentApiContext");

const mockUsePaymentApi = usePaymentApi as jest.MockedFunction<typeof usePaymentApi>;

function mockCurrenciesCall(impl: () => Promise<unknown>) {
    mockUsePaymentApi.mockReturnValue({ getCurrencies: jest.fn().mockImplementation(impl) } as unknown as ReturnType<typeof usePaymentApi>);
}

describe("CurrencySelector", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("offers exactly BTC, ETH, USDT and USDC, in that order, and nothing more", async () => {
        // The production proxy returns an empty list; the options must not depend on it.
        mockCurrenciesCall(() => Promise.resolve({ success: true, currencies: { popular: [], all: [] } }));
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={jest.fn()} />);

        const options = await screen.findAllByRole("radio");
        expect(options.map(option => option.textContent)).toEqual(
            DEPOSIT_CURRENCIES.map(currency => `${currency.symbol}${currency.name}${currency.network}`)
        );
        expect(DEPOSIT_CURRENCIES.map(currency => currency.symbol)).toEqual(["BTC", "ETH", "USDT", "USDC"]);
        expect(screen.queryByText(/more options/i)).toBeNull();
        expect(screen.queryByText(/show less/i)).toBeNull();
    });

    it("shows every option with an image logo, not a text glyph", async () => {
        mockCurrenciesCall(() => Promise.resolve({ success: true }));
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={jest.fn()} />);
        const options = await screen.findAllByRole("radio");
        for (const option of options) {
            expect(option.querySelector("img")).not.toBeNull();
        }
    });

    it("marks the selected currency and reports the NOWPayments ticker on click", async () => {
        mockCurrenciesCall(() => Promise.resolve({ success: true }));
        const onSelect = jest.fn();
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={onSelect} />);

        const options = await screen.findAllByRole("radio");
        expect(options[0]).toHaveAttribute("aria-checked", "true");
        expect(options[3]).toHaveAttribute("aria-checked", "false");

        fireEvent.click(options[3]);
        expect(onSelect).toHaveBeenCalledWith("usdc"); // NOWPayments' code for USDC on Ethereum — not "usdcerc20"
        fireEvent.click(options[2]);
        expect(onSelect).toHaveBeenCalledWith("usdterc20");
    });

    it("surfaces a failed reachability check instead of the grid", async () => {
        mockCurrenciesCall(() => Promise.resolve({ success: false }));
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={jest.fn()} />);
        expect(await screen.findByText("Failed to load currencies")).toBeInTheDocument();
        expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    it("surfaces an unreachable payment service", async () => {
        mockCurrenciesCall(() => Promise.reject(new Error("network down")));
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={jest.fn()} />);
        expect(await screen.findByText("Could not connect to payment service")).toBeInTheDocument();
    });

    it("shows a spinner until the check resolves", async () => {
        let resolve: (value: unknown) => void = () => {};
        mockCurrenciesCall(() => new Promise(r => (resolve = r)));
        render(<CurrencySelector selectedCurrency="btc" onCurrencySelect={jest.fn()} />);
        expect(screen.getByAltText("loading")).toBeInTheDocument();
        resolve({ success: true });
        await waitFor(() => expect(screen.queryByAltText("loading")).toBeNull());
    });
});
