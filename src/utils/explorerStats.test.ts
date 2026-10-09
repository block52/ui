import { ADDRESS_COLORS, addressColor, averageBlockTimeSeconds, countDistinct } from "./explorerStats";

describe("addressColor", () => {
    it("is deterministic and from the palette", () => {
        const a = addressColor("b521glxsr7paju38");
        expect(addressColor("b521glxsr7paju38")).toBe(a);
        expect(ADDRESS_COLORS).toContain(a);
    });

    it("spreads different addresses over several colours", () => {
        const colours = new Set(["b5216phr", "b5214qx6", "b521glxs", "b5210cka", "b521aaaa", "b521zzzz"].map(addressColor));
        expect(colours.size).toBeGreaterThan(1);
    });
});

describe("averageBlockTimeSeconds", () => {
    it("averages the interval between blocks regardless of order", () => {
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:10Z", "2026-01-01T00:00:00Z", "2026-01-01T00:00:05Z"])).toBe(5);
    });

    it("returns null with fewer than two valid times", () => {
        expect(averageBlockTimeSeconds([])).toBeNull();
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:00Z", "not a date"])).toBeNull();
    });
});

describe("countDistinct", () => {
    it("counts unique non-empty values", () => {
        expect(countDistinct(["a", "b", "a", ""])).toBe(2);
    });
});
