import { formatMicroUsd } from "./moneyDisplay";
import { compareSessionCashOut, sessionCashOutAmountClass, sessionPrizeAmountRowClass, sessionPrizeCashOutClass } from "./sessionCashOut";

/** What the profile table prints, grouping commas removed so it can be compared. */
function displayedDollars(micro: number): string {
    return formatMicroUsd(micro, true).replace(/,/g, "");
}

describe("compareSessionCashOut", () => {
    it("calls a cash-out above the displayed buy-in a profit", () => {
        expect(displayedDollars(2_000_000)).toBe("2.00");
        expect(displayedDollars(7_200_000)).toBe("7.20");
        expect(compareSessionCashOut(2_000_000, 7_200_000)).toBe("profit");
    });

    it("calls a cash-out below the displayed buy-in a loss, including a busted 0.00", () => {
        expect(displayedDollars(5_000_000)).toBe("5.00");
        expect(displayedDollars(1_250_000)).toBe("1.25");
        expect(compareSessionCashOut(5_000_000, 1_250_000)).toBe("loss");

        expect(displayedDollars(10_000)).toBe("0.01");
        expect(displayedDollars(0)).toBe("0.00");
        expect(compareSessionCashOut(10_000, 0)).toBe("loss");
    });

    it("treats amounts that display as the same two decimals as even", () => {
        expect(displayedDollars(2_000_000)).toBe("2.00");
        expect(compareSessionCashOut(2_000_000, 2_000_000)).toBe("even");

        // 1,990,001 micro ceilings to 2.00, same as an exact 2.00 cash-out.
        expect(displayedDollars(1_990_001)).toBe("2.00");
        expect(displayedDollars(2_000_000)).toBe("2.00");
        expect(compareSessionCashOut(1_990_001, 2_000_000)).toBe("even");

        // One micro-unit past an exact dollar still prints as the next cent.
        expect(displayedDollars(2_000_001)).toBe("2.01");
        expect(compareSessionCashOut(2_000_000, 2_000_001)).toBe("profit");

        // A sub-cent cash-out that ceilings to the same cent as the buy-in is even.
        expect(displayedDollars(10_000)).toBe("0.01");
        expect(displayedDollars(1)).toBe("0.01");
        expect(compareSessionCashOut(10_000, 1)).toBe("even");
    });

    it("keeps grouped table labels on the same cents", () => {
        expect(formatMicroUsd(1_234_560_000, true)).toBe("1,234.56");
        expect(compareSessionCashOut(1_234_560_000, 1_234_560_000)).toBe("even");
        expect(displayedDollars(1_000_000_001)).toBe("1000.01");
        expect(compareSessionCashOut(1_000_000_000, 1_000_000_001)).toBe("profit");
        expect(displayedDollars(999_990_001)).toBe("1000.00");
        expect(compareSessionCashOut(999_990_001, 1_000_000_000)).toBe("even");
    });

    it("follows the display ceiling for a negative amount", () => {
        expect(displayedDollars(-200_001)).toBe("-0.20");
        expect(compareSessionCashOut(0, -200_001)).toBe("loss");
        expect(displayedDollars(-1)).toBe("0.00");
        expect(compareSessionCashOut(0, -1)).toBe("even");
    });

    it("leaves an unknown or non-numeric cash-out uncompared", () => {
        expect(compareSessionCashOut(2_000_000, undefined)).toBeUndefined();
        expect(compareSessionCashOut(Number.NaN, 0)).toBeUndefined();
        expect(compareSessionCashOut(2_000_000, Number.POSITIVE_INFINITY)).toBeUndefined();
        expect(compareSessionCashOut(Number.NEGATIVE_INFINITY, 0)).toBeUndefined();
    });
});

describe("sessionCashOutAmountClass", () => {
    it("uses the profit and loss text colours and leaves even or unknown rows alone", () => {
        expect(sessionCashOutAmountClass(2_000_000, 7_200_000)).toBe("text-green-400");
        expect(sessionCashOutAmountClass(10_000, 0)).toBe("text-red-400");
        expect(sessionCashOutAmountClass(5_000_000, 1_250_000)).toBe("text-red-400");
        expect(sessionCashOutAmountClass(2_000_000, 2_000_000)).toBe("");
        expect(sessionCashOutAmountClass(1_990_001, 2_000_000)).toBe("");
        expect(sessionCashOutAmountClass(2_000_000, undefined)).toBe("");
        expect(sessionCashOutAmountClass(Number.NaN, 1)).toBe("");
    });
});

describe("sessionPrizeCashOutClass", () => {
    it("stacks the prize badge above the amount on phones and keeps one line from sm up", () => {
        const layout = sessionPrizeCashOutClass();
        expect(layout).toContain("flex-col");
        expect(layout).toContain("sm:flex-row");
        expect(sessionPrizeAmountRowClass()).toContain("whitespace-nowrap");
        expect(sessionCashOutAmountClass(1_000_000, 3_510_000)).toBe("text-green-400");
    });
});
