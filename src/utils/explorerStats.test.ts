import { addressColor, averageBlockTimeSeconds, countDistinct } from "./explorerStats";

describe("addressColor", () => {
    it("is deterministic and from the palette", () => {
        const a = addressColor("b521glxsr7paju38");
        expect(addressColor("b521glxsr7paju38")).toBe(a);
        expect(a).toMatch(/^#[0-9a-f]{6}$/);
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

    it("handles non-monotonic times", () => {
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:20Z", "2026-01-01T00:00:00Z", "2026-01-01T00:00:30Z", "2026-01-01T00:00:10Z"])).toBe(10);
    });

    it("counts a duplicate timestamp as a block in the same instant", () => {
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "2026-01-01T00:00:06Z"])).toBe(3);
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"])).toBe(0);
    });

    it("ignores invalid times among valid ones", () => {
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:00Z", "nope", "2026-01-01T00:00:10Z"])).toBe(10);
    });

    it("handles an array too large to spread into Math.max", () => {
        const start = Date.parse("2026-01-01T00:00:00Z");
        const times = Array.from({ length: 200000 }, (_, i) => new Date(start + i * 1000).toISOString());
        expect(averageBlockTimeSeconds(times)).toBe(1);
    });

    it("returns null with fewer than two valid times", () => {
        expect(averageBlockTimeSeconds([])).toBeNull();
        expect(averageBlockTimeSeconds(["2026-01-01T00:00:00Z", "not a date"])).toBeNull();
    });
});

describe("countDistinct", () => {
    it("counts unique non-empty values", () => {
        expect(countDistinct(["a", "b", "a", ""])).toBe(2);
        expect(countDistinct([])).toBe(0);
    });
});
