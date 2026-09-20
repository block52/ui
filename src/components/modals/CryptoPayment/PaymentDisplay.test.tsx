import { render, screen } from "@testing-library/react";
import PaymentDisplay from "./PaymentDisplay";
import { USDC_ERC20_CONTRACT, USDT_ERC20_CONTRACT } from "../../../config/depositCurrencies";
import { ethToWei, toSmallestUnit } from "../../../utils/currencyUtils";

jest.mock("../../../hooks/useCopyToClipboard", () => ({ useCopyToClipboard: () => ({ copy: jest.fn(), copied: false }) }));
jest.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} /> }));

const ADDRESS = "0x1111111111111111111111111111111111111111";
const BTC_ADDRESS = "bc1qexampleaddress0000000000000000000000000";

function renderFor(payCurrency: string, payAmount: number, paymentAddress = ADDRESS) {
    return render(<PaymentDisplay paymentAddress={paymentAddress} payAmount={payAmount} payCurrency={payCurrency} expiresAt={new Date(Date.now() + 3_600_000).toISOString()} priceAmount={25} />);
}

const qrValue = () => screen.getByTestId("qr").getAttribute("data-value");

describe("PaymentDisplay", () => {
    it("encodes a BTC payment as a BIP-21 URI", () => {
        renderFor("btc", 0.00042, BTC_ADDRESS);
        expect(qrValue()).toBe(`bitcoin:${BTC_ADDRESS}?amount=0.00042`);
        expect(screen.getAllByText(/Bitcoin Network/).length).toBeGreaterThan(0);
    });

    it("encodes an ETH payment as an EIP-681 value transfer", () => {
        renderFor("eth", 0.01);
        expect(qrValue()).toBe(`ethereum:${ADDRESS}?value=${ethToWei(0.01)}`);
    });

    it("encodes USDT as an EIP-681 token transfer on the mainnet USDT contract", () => {
        renderFor("usdterc20", 25);
        expect(qrValue()).toBe(`ethereum:${USDT_ERC20_CONTRACT}@1/transfer?address=${ADDRESS}&uint256=${toSmallestUnit(25, 6)}`);
        expect(screen.getAllByText(/Ethereum \(ERC-20\)/).length).toBeGreaterThan(0);
    });

    it("encodes USDC (NOWPayments ticker \"usdc\") as an EIP-681 token transfer on the mainnet USDC contract", () => {
        renderFor("usdc", 25);
        expect(qrValue()).toBe(`ethereum:${USDC_ERC20_CONTRACT}@1/transfer?address=${ADDRESS}&uint256=${toSmallestUnit(25, 6)}`);
        expect(screen.getAllByText(/USDC/).length).toBeGreaterThan(0);
    });

    it("accepts the ticker in any case, as NOWPayments echoes it", () => {
        renderFor("USDC", 25);
        expect(qrValue()).toContain(USDC_ERC20_CONTRACT);
    });

    it("refuses a currency we do not offer instead of rendering a wrong network warning (Commandment 7)", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderFor("sol", 1)).toThrow(/Unknown deposit currency "sol"/);
        expect(() => renderFor("usdcerc20", 1)).toThrow(/usdcerc20/);
    });
});
