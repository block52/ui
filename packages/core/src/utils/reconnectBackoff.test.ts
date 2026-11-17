import { RECONNECT_BASE_MS, RECONNECT_CAP_MS, RECONNECT_JITTER, RECONNECT_MAX_ATTEMPTS, reconnectDelayMs } from "./reconnectBackoff";

const noJitter = () => 0.5; // (0.5 * 2 - 1) * jitter = 0

describe("reconnectDelayMs", () => {
    it("doubles from the base per attempt", () => {
        expect(reconnectDelayMs(1, noJitter)).toBe(RECONNECT_BASE_MS);
        expect(reconnectDelayMs(2, noJitter)).toBe(RECONNECT_BASE_MS * 2);
        expect(reconnectDelayMs(3, noJitter)).toBe(RECONNECT_BASE_MS * 4);
    });

    it("caps at the ceiling", () => {
        expect(reconnectDelayMs(6, noJitter)).toBe(RECONNECT_CAP_MS);
        expect(reconnectDelayMs(RECONNECT_MAX_ATTEMPTS, noJitter)).toBe(RECONNECT_CAP_MS);
        expect(reconnectDelayMs(50, noJitter)).toBe(RECONNECT_CAP_MS);
    });

    it("applies symmetric jitter within the bound", () => {
        expect(reconnectDelayMs(1, () => 0)).toBe(Math.round(RECONNECT_BASE_MS * (1 - RECONNECT_JITTER)));
        expect(reconnectDelayMs(1, () => 0.999999)).toBeLessThanOrEqual(Math.round(RECONNECT_BASE_MS * (1 + RECONNECT_JITTER)));
        for (let i = 0; i < 200; i++) {
            const delay = reconnectDelayMs(4);
            expect(delay).toBeGreaterThanOrEqual(RECONNECT_BASE_MS * 8 * (1 - RECONNECT_JITTER) - 1);
            expect(delay).toBeLessThanOrEqual(RECONNECT_BASE_MS * 8 * (1 + RECONNECT_JITTER) + 1);
        }
    });

    it("treats a non-positive attempt as the first", () => {
        expect(reconnectDelayMs(0, noJitter)).toBe(RECONNECT_BASE_MS);
        expect(reconnectDelayMs(-3, noJitter)).toBe(RECONNECT_BASE_MS);
    });

    it("gives up within a few minutes in total", () => {
        let total = 0;
        for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
            total += reconnectDelayMs(attempt, noJitter);
        }
        expect(total).toBeLessThan(5 * 60_000);
        expect(total).toBeGreaterThan(60_000);
    });
});
