import { formatMicroUsd, formatUsd } from "./moneyDisplay";
import { parseUsdcToMicro, formatMicroAsUsdc } from "../constants/currency";
import { formatSliderInputValue, formatUSDCToSimpleDollars } from "./numberUtils";

describe("display-only upward cent rounding", () => {
    test.each([
        ["0", "0.00"],
        ["200000", "0.20"],
        ["200001", "0.21"],
        ["1", "0.01"],
        ["333333", "0.34"],
        ["999999", "1.00"],
        ["1100000", "1.10"],
        ["1000001", "1.01"],
        ["-200001", "-0.20"],
        ["-1", "0.00"],
        ["-210000", "-0.21"],
        ["9007199254740993000001", "9007199254740993.01"]
    ])("formats micro amount %s as %s", (value, expected) => {
        expect(formatMicroUsd(value)).toBe(expected);
        expect(formatMicroUsd(BigInt(value))).toBe(expected);
    });

    test.each([
        [0, "0.00"],
        [0.200001, "0.21"],
        [1.1, "1.10"],
        [1.01, "1.01"],
        [0.1 + 0.2, "0.30"],
        [0.0000001, "0.01"],
        ["1e-7", "0.01"],
        ["12.000000001", "12.01"],
        ["-12.001", "-12.00"],
        ["1e3", "1000.00"]
    ])("formats dollars %s as %s", (value, expected) => {
        expect(formatUsd(value)).toBe(expected);
    });

    it("keeps grouping and invalid-data handling explicit", () => {
        expect(formatMicroUsd("1234567890001", true)).toBe("1,234,567.90");
        expect(formatUsd("1234567.89", true)).toBe("1,234,567.89");
        expect(formatUsd(NaN)).toBe("—");
        expect(formatUsd(Infinity)).toBe("—");
        expect(formatUsd("invalid")).toBe("—");
        expect(formatUsd("")).toBe("—");
    });

    it("does not change transaction conversions or existing editable values", () => {
        expect(parseUsdcToMicro("0.200001")).toBe(200001n);
        expect(formatMicroAsUsdc("200001", 6)).toBe("0.200001");
        expect(formatUSDCToSimpleDollars("200001")).toBe("0.20");
        expect(formatSliderInputValue(0.200001, false)).toBe("0.20");
        expect(formatSliderInputValue(1500, true)).toBe("1500");
    });
});
