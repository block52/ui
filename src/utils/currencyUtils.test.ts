import { toSmallestUnit, ethToWei } from "./currencyUtils";

describe("currencyUtils", () => {
    describe("toSmallestUnit", () => {
        it("should convert whole numbers", () => {
            expect(toSmallestUnit(1, 6)).toBe("1000000");
            expect(toSmallestUnit(100, 6)).toBe("100000000");
        });

        it("should convert decimal amounts", () => {
            expect(toSmallestUnit(1.5, 6)).toBe("1500000");
            expect(toSmallestUnit(0.25, 6)).toBe("250000");
        });

        it("should handle zero", () => {
            expect(toSmallestUnit(0, 6)).toBe("0");
            expect(toSmallestUnit(0, 18)).toBe("0");
        });

        it("should truncate excess decimal places", () => {
            expect(toSmallestUnit(1.1234567, 6)).toBe("1123456");
        });

        it("should pad short decimal places", () => {
            expect(toSmallestUnit(1.1, 6)).toBe("1100000");
        });

        it("should handle 18 decimals (ETH-scale)", () => {
            expect(toSmallestUnit(1, 18)).toBe("1000000000000000000");
            expect(toSmallestUnit(0.01, 18)).toBe("10000000000000000");
        });
    });

    describe("ethToWei", () => {
        it("should convert 1 ETH to wei", () => {
            expect(ethToWei(1)).toBe("1000000000000000000");
        });

        it("should convert 0.01 ETH to wei", () => {
            expect(ethToWei(0.01)).toBe("10000000000000000");
        });

        it("should convert 0 ETH to wei", () => {
            expect(ethToWei(0)).toBe("0");
        });

        it("should convert small ETH amounts", () => {
            expect(ethToWei(0.001)).toBe("1000000000000000");
        });
    });
});
