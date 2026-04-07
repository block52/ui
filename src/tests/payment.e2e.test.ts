/**
 * @jest-environment node
 */
import { PaymentApi } from "../apis/Api";

interface PaymentData {
    payment_id: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    price_amount: number;
    expires_at: string;
    success?: boolean;
}

interface HotWalletInfo {
    address: string;
    ethBalance: string;
    usdcBalance: string;
    bridgeApproved: boolean;
}

interface ApproveBridgeResponse {
    success: boolean;
    message: string;
    txHash: string;
    etherscanUrl: string;
}

const PROXY_URL = "https://poker-vm-proxy-js-ixe4h.ondigitalocean.app";

describe("Payment API E2E Tests", () => {
    const paymentApi = new PaymentApi({ baseUrl: PROXY_URL, secure: false });

    beforeAll(async () => {
        // Setup: Clean up any test data if needed
    });

    afterAll(async () => {
        // Cleanup: Remove test payment records
    });

    describe("Get Currencies", () => {
        it("should retrieve supported currencies", async () => {
            const currencies = (await paymentApi.getCurrencies()) as { success: boolean; currencies: { popular: string[]; all: string[] } };
            expect(currencies.success).toBe(true);
        });
    });

    describe("Hot wallet info", () => {
        it("should retrieve hot wallet info", async () => {
            const info = (await paymentApi.getHotWalletInfo()) as HotWalletInfo;
            expect(info.address).toBeDefined();
            expect(info.ethBalance).toBeDefined();
            expect(info.usdcBalance).toBeDefined();
            expect(info.bridgeApproved).toBeDefined();
        });
    });

    describe("Approve Bridge", () => {
        it("should approve the bridge successfully", async () => {
            const response = (await paymentApi.approveBridge()) as ApproveBridgeResponse;
            expect(response).toBeDefined();
            expect(response.success).toBe(true);
        });
    });

    describe("Create Payment", () => {
        it("should fail when amount is too small", async () => {
            try {
                await paymentApi.createCryptoPayment({
                    amount: 1,
                    currency: "usdterc20",
                    cosmosAddress: "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p"
                });
            } catch (error: any) {
                expect(error.error).toBe("Amount too small");
            }
        });

        it("should create a new payment successfully", async () => {
            const paymentData = {
                amount: 10,
                currency: "usdterc20",
                cosmosAddress: "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p"
            };

            const response = (await paymentApi.createCryptoPayment(paymentData)) as PaymentData;
            expect(response).toBeDefined();
            expect(response.payment_id).toBeDefined();
            expect(response.pay_currency).toBe(paymentData.currency);
            expect(response.success).toBe(true);
        });
    });
});
