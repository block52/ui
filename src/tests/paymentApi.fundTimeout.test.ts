import { PaymentApi, FUND_MOVING_TIMEOUT_MS } from "../apis/Api";

// The hot-wallet sends must outlast the proxy's 2-minute confirmation wait.
describe("PaymentApi fund-moving calls", () => {
    const api = new PaymentApi({ baseUrl: "http://proxy.test", secure: false, timeout: 5000 });
    // HTTPClient keeps its axios instance private; read it for the assertion only.
    const client = (api as unknown as { client: { post: jest.Mock; get: jest.Mock } }).client;

    beforeEach(() => {
        client.post = jest.fn().mockResolvedValue({ data: { success: true } });
        client.get = jest.fn().mockResolvedValue({ data: { success: true } });
    });

    it.each([
        ["retryBridge", () => api.retryBridge("5423399173", "k")],
        ["manualBridge", () => api.manualBridge({ cosmosAddress: "b521x", amount: "1" }, "k")],
        ["approveBridge", () => api.approveBridge("k")]
    ])("%s waits long enough and sends the admin key", async (_name, call) => {
        await call();
        const config = client.post.mock.calls[0][2];
        expect(config.timeout).toBe(FUND_MOVING_TIMEOUT_MS);
        expect(FUND_MOVING_TIMEOUT_MS).toBeGreaterThan(120_000);
        expect(config.headers["X-Admin-Key"]).toBe("k");
    });

    it("read-only list keeps the normal timeout", async () => {
        await api.getUnbridgedPayments("k");
        expect(client.get.mock.calls[0][1].timeout).toBeUndefined();
    });
});
