import {
    formatBalance,
    formatToFixed,
    formatWinningAmount,
    formatUSDCToSimpleDollars,
    formatForSitAndGo,
    formatForCashGame,
    convertAmountToBigInt,
    formatSliderInputValue,
    parseSliderInput,
    bigBlindInStackUnits,
    formatBigBlinds,
    formatSeatStack
} from "./numberUtils";

describe("numberUtils", () => {
    describe("formatBalance", () => {
        it("should format balance from USDC micro-units (6 decimals) to dollars", () => {
            expect(formatBalance("1000000")).toBe("1.00");      // 1 USDC
            expect(formatBalance("2500000")).toBe("2.50");      // 2.5 USDC
            expect(formatBalance("100000000")).toBe("100.00");  // 100 USDC
        });

        it("should handle zero balance", () => {
            expect(formatBalance("0")).toBe("0.00");
            expect(formatBalance(0)).toBe("0.00");
        });
    });

    describe("formatToFixed", () => {
        it("should format number to 2 decimal places", () => {
            expect(formatToFixed(1.5)).toBe("1.50");
            expect(formatToFixed(10)).toBe("10.00");
            expect(formatToFixed(0.123)).toBe("0.12");
        });
    });

    describe("formatWinningAmount", () => {
        it("should format winning amount with commas", () => {
            expect(formatWinningAmount("100")).toBe("100.00");
            expect(formatWinningAmount("1000")).toBe("1,000.00");
            expect(formatWinningAmount("1234567.89")).toBe("1,234,567.89");
        });
    });

    describe("formatUSDCToSimpleDollars", () => {
        it("should format USDC (6 decimals) to dollars", () => {
            expect(formatUSDCToSimpleDollars("1000000")).toBe("1.00");
            expect(formatUSDCToSimpleDollars("2500000")).toBe("2.50");
            expect(formatUSDCToSimpleDollars("100000000")).toBe("100.00");
        });

        it("should handle undefined and null", () => {
            expect(formatUSDCToSimpleDollars(undefined)).toBe("0.00");
            expect(formatUSDCToSimpleDollars(null)).toBe("0.00");
        });

        it("should handle bigint", () => {
            expect(formatUSDCToSimpleDollars(BigInt("1000000"))).toBe("1.00");
        });
    });

    describe("formatForSitAndGo", () => {
        it("should format stack values as whole numbers with commas", () => {
            expect(formatForSitAndGo(10000)).toBe("10,000");
            expect(formatForSitAndGo(1500)).toBe("1,500");
            expect(formatForSitAndGo(100)).toBe("100");
        });

        it("should floor decimal values", () => {
            expect(formatForSitAndGo(1500.75)).toBe("1,500");
        });
    });

    describe("formatForCashGame", () => {
        it("should format with dollar sign and 2 decimals", () => {
            expect(formatForCashGame(100)).toBe("$100.00");
            expect(formatForCashGame(25.5)).toBe("$25.50");
            expect(formatForCashGame(0)).toBe("$0.00");
        });
    });

    describe("convertAmountToBigInt", () => {
        it("should convert amount string to bigint with decimals", () => {
            expect(convertAmountToBigInt("1", 18)).toBe(BigInt("1000000000000000000"));
            expect(convertAmountToBigInt("1", 6)).toBe(BigInt("1000000"));
        });

        it("should return 0 for empty or invalid values", () => {
            expect(convertAmountToBigInt("", 18)).toBe(BigInt(0));
            expect(convertAmountToBigInt("0", 18)).toBe(BigInt(0));
        });
    });

    // Bet/raise slider input helpers — issue #488 (SNG must show whole chips, no decimals)
    describe("formatSliderInputValue", () => {
        it("should render whole chips with no decimals for tournaments", () => {
            expect(formatSliderInputValue(1500, true)).toBe("1500");
            expect(formatSliderInputValue(0, true)).toBe("0");
        });

        it("should floor any stray fractional chip value for tournaments", () => {
            expect(formatSliderInputValue(1500.5, true)).toBe("1500");
            expect(formatSliderInputValue(1500.999, true)).toBe("1500");
        });

        it("should never emit comma separators (must stay parseable in the text input)", () => {
            expect(formatSliderInputValue(1000000, true)).toBe("1000000");
        });

        it("should render dollars with 2 decimals for cash games", () => {
            expect(formatSliderInputValue(12.5, false)).toBe("12.50");
            expect(formatSliderInputValue(0, false)).toBe("0.00");
            expect(formatSliderInputValue(1.005, false)).toBe("1.00");
        });
    });

    describe("parseSliderInput", () => {
        describe("tournament mode (whole chips)", () => {
            it("should parse a whole-chip entry, subtracting the display offset", () => {
                expect(parseSliderInput("1500", 0, true)).toBe(1500);
                expect(parseSliderInput("1520", 20, true)).toBe(1500);
            });

            it("should reject any entry containing a decimal point", () => {
                expect(parseSliderInput("1500.5", 0, true)).toBeNull();
                expect(parseSliderInput("1500.", 0, true)).toBeNull();
                expect(parseSliderInput(".5", 0, true)).toBeNull();
            });

            it("should reject non-numeric entries", () => {
                expect(parseSliderInput("abc", 0, true)).toBeNull();
            });

            it("should treat an empty string as 0", () => {
                expect(parseSliderInput("", 0, true)).toBe(0);
            });

            it("should never return a negative amount", () => {
                expect(parseSliderInput("10", 50, true)).toBe(0);
            });
        });

        describe("cash mode (dollars, up to 2 decimals)", () => {
            it("should parse a dollar entry, subtracting the display offset", () => {
                expect(parseSliderInput("12.50", 0, false)).toBe(12.5);
                expect(parseSliderInput("12.50", 2.5, false)).toBe(10);
            });

            it("should not commit an incomplete decimal entry (mid-typing)", () => {
                expect(parseSliderInput("12.", 0, false)).toBeNull();
            });

            it("should reject entries with more than 2 decimal places", () => {
                expect(parseSliderInput("12.505", 0, false)).toBeNull();
            });

            it("should treat an empty string as 0", () => {
                expect(parseSliderInput("", 0, false)).toBe(0);
            });

            it("should never return a negative amount", () => {
                expect(parseSliderInput("1.00", 5, false)).toBe(0);
            });
        });
    });

    describe("stacks in big blinds (ui#895)", () => {
        describe("bigBlindInStackUnits", () => {
            it("converts a cash blind from micro-USDC to dollars", () => {
                expect(bigBlindInStackUnits("20000", false)).toBe(0.02);
            });

            it("keeps a tournament blind in chips", () => {
                expect(bigBlindInStackUnits("50", true)).toBe(50);
            });

            it("has no answer without a usable big blind", () => {
                expect(bigBlindInStackUnits(undefined, false)).toBeNull();
                expect(bigBlindInStackUnits(null, true)).toBeNull();
                expect(bigBlindInStackUnits("", true)).toBeNull();
                expect(bigBlindInStackUnits("0", false)).toBeNull();
                expect(bigBlindInStackUnits("abc", true)).toBeNull();
            });
        });

        describe("formatBigBlinds", () => {
            it("formats to one decimal, dropping .0", () => {
                expect(formatBigBlinds(99.5)).toBe("99.5 BB");
                expect(formatBigBlinds(30)).toBe("30 BB");
                expect(formatBigBlinds(29.96)).toBe("30 BB");
                expect(formatBigBlinds(0.5)).toBe("0.5 BB");
                expect(formatBigBlinds(12345)).toBe("12,345 BB");
            });
        });

        describe("formatSeatStack", () => {
            it("shows a cash stack in big blinds", () => {
                expect(formatSeatStack(1.99, false, 0.02)).toBe("99.5 BB");
            });

            it("shows a tournament stack in big blinds of the current level", () => {
                expect(formatSeatStack(1500, true, 50)).toBe("30 BB");
                expect(formatSeatStack(1500, true, 100)).toBe("15 BB");
            });

            it("falls back to $ / chips without a big blind", () => {
                expect(formatSeatStack(100, false, null)).toBe("$100.00");
                expect(formatSeatStack(10000, true, null)).toBe("10,000");
                expect(formatSeatStack(100, false, 0)).toBe("$100.00");
            });
        });
    });
});
