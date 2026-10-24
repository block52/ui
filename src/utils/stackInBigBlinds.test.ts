import { formatBigBlinds, stackInBigBlinds } from "./stackInBigBlinds";

describe("stacks in big blinds (ui#895)", () => {
    it("divides the stack by the big blind", () => {
        expect(stackInBigBlinds(1.99, 0.02)).toBeCloseTo(99.5);
        expect(stackInBigBlinds(1500, 50)).toBe(30);
    });

    it("has no answer without a big blind", () => {
        expect(stackInBigBlinds(100, 0)).toBeNull();
        expect(stackInBigBlinds(100, NaN)).toBeNull();
    });

    it("formats to one decimal, dropping .0", () => {
        expect(formatBigBlinds(99.5)).toBe("99.5 BB");
        expect(formatBigBlinds(30)).toBe("30 BB");
        expect(formatBigBlinds(29.96)).toBe("30 BB");
        expect(formatBigBlinds(0.5)).toBe("0.5 BB");
        expect(formatBigBlinds(12345)).toBe("12,345 BB");
    });
});
