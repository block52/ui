/**
 * Tests for USDC <-> micro-unit conversion (#610).
 *
 * The bug: `Math.floor(usdcAmount * 1_000_000)`. The float multiply happens
 * BEFORE the floor, so 2.01 * 1e6 is 2009999.9999999998 and floors to 2009999.
 * Converting to bigint afterwards cannot restore a digit already lost. 1.2% of
 * ordinary cent amounts were short by one micro-unit.
 */
import { parseUsdcToMicro, usdcToMicroBigInt, USDC_TO_MICRO } from "./currency";

/** The exact values the review reported, plus the ones found while verifying. */
const KNOWN_BAD: [string, bigint][] = [
    ["2.01", 2_010_000n],
    ["2.03", 2_030_000n],
    ["2.05", 2_050_000n],
    ["2.07", 2_070_000n],
    ["2.09", 2_090_000n],
    ["4.02", 4_020_000n],
    ["8.11", 8_110_000n],
    ["1.005", 1_005_000n]
];

describe("parseUsdcToMicro", () => {
    describe("the amounts that were wrong", () => {
        it.each(KNOWN_BAD)("%s USDC -> %s micro", (input, expected) => {
            expect(parseUsdcToMicro(input)).toBe(expected);
        });
    });

    describe("ordinary values", () => {
        it.each([
            ["0", 0n],
            ["0.000001", 1n],
            ["0.01", 10_000n],
            ["1", 1_000_000n],
            ["1.5", 1_500_000n],
            ["1.50", 1_500_000n],
            ["10.000000", 10_000_000n],
            ["1000000", 1_000_000_000_000n]
        ])("%s USDC -> %s micro", (input, expected) => {
            expect(parseUsdcToMicro(input)).toBe(expected);
        });

        it("tolerates surrounding whitespace and a leading +", () => {
            expect(parseUsdcToMicro("  2.01  ")).toBe(2_010_000n);
            expect(parseUsdcToMicro("+2.01")).toBe(2_010_000n);
        });

        it("accepts a bare leading or trailing decimal point", () => {
            expect(parseUsdcToMicro(".5")).toBe(500_000n);
            expect(parseUsdcToMicro("5.")).toBe(5_000_000n);
        });
    });

    describe("rejects rather than silently truncating", () => {
        it("refuses more precision than USDC has", () => {
            // Truncating here would take the user's money without telling them.
            expect(() => parseUsdcToMicro("1.0000001")).toThrow(/more than 6 decimal/i);
        });

        it.each([["", /empty/i], ["abc", /not a valid/i], ["1.2.3", /not a valid/i], ["1e6", /not a valid/i], ["-1", /negative/i]])(
            "refuses %p",
            (input, message) => {
                expect(() => parseUsdcToMicro(input as string)).toThrow(message as RegExp);
            }
        );
    });

    describe("exhaustive", () => {
        it("is exact for every cent value from 0.01 to 1000.00", () => {
            // This sweep is what would have caught the original bug.
            const wrong: string[] = [];
            for (let cents = 1; cents <= 100_000; cents++) {
                const text = (cents / 100).toFixed(2);
                const expected = BigInt(cents) * 10_000n;
                if (parseUsdcToMicro(text) !== expected) {
                    wrong.push(text);
                }
            }
            expect(wrong).toEqual([]);
        });
    });
});

describe("usdcToMicroBigInt (number input)", () => {
    it.each(KNOWN_BAD)("%s USDC -> %s micro", (input, expected) => {
        expect(usdcToMicroBigInt(Number(input))).toBe(expected);
    });

    it("is exact for every cent value from 0.01 to 1000.00", () => {
        const wrong: number[] = [];
        for (let cents = 1; cents <= 100_000; cents++) {
            const value = cents / 100;
            if (usdcToMicroBigInt(value) !== BigInt(cents) * 10_000n) {
                wrong.push(value);
            }
        }
        expect(wrong).toEqual([]);
    });

    it("rounds to the nearest micro-unit beyond USDC precision", () => {
        // A slider can produce more precision than the currency has; nearest is
        // the honest answer, and it must not drift downwards.
        expect(usdcToMicroBigInt(1.00000049)).toBe(1_000_000n);
        expect(usdcToMicroBigInt(1.00000051)).toBe(1_000_001n);
    });

    it("refuses values it cannot represent exactly", () => {
        expect(() => usdcToMicroBigInt(NaN)).toThrow(/finite/i);
        expect(() => usdcToMicroBigInt(Infinity)).toThrow(/finite/i);
        expect(() => usdcToMicroBigInt(Number.MAX_SAFE_INTEGER)).toThrow(/precision/i);
    });

    it("agrees with the string parser", () => {
        for (const [text, expected] of KNOWN_BAD) {
            expect(usdcToMicroBigInt(Number(text))).toBe(expected);
            expect(parseUsdcToMicro(text)).toBe(expected);
        }
    });
});

describe("the constant that made this easy to get wrong", () => {
    it("USDC_TO_MICRO is 10^6", () => {
        expect(USDC_TO_MICRO).toBe(1_000_000);
    });
});
