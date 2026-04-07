import { floorToCents, calculateMinTopUp, calculateMaxTopUp } from "./topUpUtils";

describe("topUpUtils", () => {
    describe("floorToCents", () => {
        it("should floor fractional cents down", () => {
            expect(floorToCents(0.699996)).toBe(0.69);
            expect(floorToCents(0.691)).toBe(0.69);
            expect(floorToCents(0.699)).toBe(0.69);
        });

        it("should not change exact cent values", () => {
            expect(floorToCents(0.69)).toBe(0.69);
            expect(floorToCents(1.00)).toBe(1.00);
            expect(floorToCents(5.50)).toBe(5.50);
        });

        it("should handle larger amounts", () => {
            expect(floorToCents(100.999)).toBe(100.99);
            expect(floorToCents(1000.001)).toBe(1000.00);
        });

        it("should handle zero", () => {
            expect(floorToCents(0)).toBe(0);
        });

        it("should handle very small amounts", () => {
            expect(floorToCents(0.001)).toBe(0);
            expect(floorToCents(0.009)).toBe(0);
            expect(floorToCents(0.01)).toBe(0.01);
        });

        it("should handle negative amounts", () => {
            // Floor moves toward negative infinity
            expect(floorToCents(-0.691)).toBe(-0.70);
            expect(floorToCents(-1.001)).toBe(-1.01);
        });
    });

    describe("calculateMinTopUp", () => {
        it("should return difference when below minimum buy-in", () => {
            expect(calculateMinTopUp(0.20, 0.40)).toBe(0.20);
            expect(calculateMinTopUp(0, 0.40)).toBe(0.40);
            expect(calculateMinTopUp(0.39, 0.40)).toBeCloseTo(0.01, 10);
        });

        it("should return $0.01 when at minimum buy-in", () => {
            expect(calculateMinTopUp(0.40, 0.40)).toBe(0.01);
        });

        it("should return $0.01 when above minimum buy-in", () => {
            expect(calculateMinTopUp(1.00, 0.40)).toBe(0.01);
            expect(calculateMinTopUp(100, 0.40)).toBe(0.01);
        });

        it("should handle zero current stack", () => {
            expect(calculateMinTopUp(0, 2.00)).toBe(2.00);
        });

        it("should handle larger stake games", () => {
            expect(calculateMinTopUp(50, 100)).toBe(50);
            expect(calculateMinTopUp(100, 100)).toBe(0.01);
            expect(calculateMinTopUp(150, 100)).toBe(0.01);
        });
    });

    describe("calculateMaxTopUp", () => {
        it("should cap at wallet balance when wallet < room to max", () => {
            expect(calculateMaxTopUp(0, 10, 5)).toBe(5);
            expect(calculateMaxTopUp(0, 100, 20)).toBe(20);
        });

        it("should cap at room to max when wallet > room", () => {
            expect(calculateMaxTopUp(8, 10, 100)).toBe(2);
            expect(calculateMaxTopUp(95, 100, 1000)).toBe(5);
        });

        it("should return 0 when already at max", () => {
            expect(calculateMaxTopUp(10, 10, 100)).toBe(0);
        });

        it("should return 0 when wallet is empty", () => {
            expect(calculateMaxTopUp(0, 10, 0)).toBe(0);
        });

        it("should floor to nearest cent - the main bug fix case", () => {
            // This is the exact bug scenario from PR #234:
            // Wallet has 699996 µUSDC = $0.699996
            // Without flooring, toFixed(2) rounds to "0.70" but validation fails
            expect(calculateMaxTopUp(0, 10, 0.699996)).toBe(0.69);
        });

        it("should floor wallet-limited amounts", () => {
            expect(calculateMaxTopUp(0, 10, 5.999)).toBe(5.99);
            expect(calculateMaxTopUp(0, 10, 0.001)).toBe(0);
        });

        it("should floor room-limited amounts", () => {
            // Room to max = 10 - 9.001 = 0.999
            expect(calculateMaxTopUp(9.001, 10, 100)).toBe(0.99);
        });

        it("should handle when both limits are equal", () => {
            expect(calculateMaxTopUp(5, 10, 5)).toBe(5);
        });

        it("should handle micro stakes correctly", () => {
            // $0.01/$0.02 game, max buy-in $2.00
            expect(calculateMaxTopUp(0, 2, 0.50)).toBe(0.50);
            expect(calculateMaxTopUp(0.40, 2, 10)).toBe(1.60);
        });

        it("should handle high stakes correctly", () => {
            // $5/$10 game, max buy-in $1000
            expect(calculateMaxTopUp(0, 1000, 500)).toBe(500);
            expect(calculateMaxTopUp(800, 1000, 500)).toBe(200);
        });

        it("should handle over-max stack edge case", () => {
            // Player somehow has more than max (shouldn't happen but be safe)
            expect(calculateMaxTopUp(15, 10, 100)).toBe(-5);
            // Note: caller should check for this and show "cannot top up"
        });
    });

    describe("integration scenarios", () => {
        it("should handle PR #234 bug scenario end-to-end", () => {
            // Scenario: Player has exactly 699996 µUSDC in wallet
            // Current stack: $0, Max buy-in: $10
            const walletInDollars = 699996 / 1_000_000; // 0.699996
            const maxTopUp = calculateMaxTopUp(0, 10, walletInDollars);

            // Should be $0.69, not $0.70
            expect(maxTopUp).toBe(0.69);

            // Verify this converts back to valid micro-units
            const maxTopUpMicro = maxTopUp * 1_000_000;
            expect(maxTopUpMicro).toBe(690000);
            expect(maxTopUpMicro).toBeLessThanOrEqual(699996); // Must not exceed wallet
        });

        it("should provide consistent min/max for display", () => {
            const currentStack = 0.20;
            const minBuyIn = 0.40;
            const maxBuyIn = 2.00;
            const wallet = 1.50;

            const minTopUp = calculateMinTopUp(currentStack, minBuyIn);
            const maxTopUp = calculateMaxTopUp(currentStack, maxBuyIn, wallet);

            expect(minTopUp).toBe(0.20); // Need $0.20 to reach min buy-in
            expect(maxTopUp).toBe(1.50); // Capped by wallet (room to max is $1.80)
            expect(minTopUp).toBeLessThanOrEqual(maxTopUp);
        });

        it("should handle player at max buy-in", () => {
            const currentStack = 2.00;
            const minBuyIn = 0.40;
            const maxBuyIn = 2.00;
            const wallet = 10.00;

            const minTopUp = calculateMinTopUp(currentStack, minBuyIn);
            const maxTopUp = calculateMaxTopUp(currentStack, maxBuyIn, wallet);

            expect(minTopUp).toBe(0.01);
            expect(maxTopUp).toBe(0);
            // Caller should check maxTopUp <= 0 and show "cannot top up"
        });
    });
});
