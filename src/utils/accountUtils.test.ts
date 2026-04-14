import { formatAmount, formatPlayerId } from "./accountUtils";

describe("formatAmount", () => {
    describe("cash games (default)", () => {
        it("should format micro-units as USDC dollars", () => {
            expect(formatAmount("1000000")).toBe("$1.00");
            expect(formatAmount("500000")).toBe("$0.50");
            expect(formatAmount("10000000")).toBe("$10.00");
        });

        it("should format with Cosmos denom (uusdc → USDC)", () => {
            expect(formatAmount("1000000", "uusdc")).toBe("1.00 USDC");
            expect(formatAmount("500000", "uusdc")).toBe("0.50 USDC");
        });
    });

    describe("tournament/SNG games", () => {
        it("should format raw chip values without USDC conversion", () => {
            expect(formatAmount("75", undefined, true)).toBe("75 chips");
            expect(formatAmount("1000", undefined, true)).toBe("1,000 chips");
            expect(formatAmount("50", undefined, true)).toBe("50 chips");
        });

        it("should handle large chip values", () => {
            expect(formatAmount("10000", undefined, true)).toBe("10,000 chips");
        });

        it("should handle zero chips", () => {
            expect(formatAmount("0", undefined, true)).toBe("0 chips");
        });
    });
});

describe("formatPlayerId", () => {
    it("should show first 6 and last 4 characters", () => {
        expect(formatPlayerId("b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer")).toBe("b521qy...xqer");
    });
});
