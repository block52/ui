import { getVipTierMeta, formatScaledPercent } from "./vip";

describe("getVipTierMeta", () => {
    it("returns the matching tier metadata", () => {
        expect(getVipTierMeta("gold").label).toBe("Gold");
        expect(getVipTierMeta("gold").rakebackPct).toBe(10);
        expect(getVipTierMeta("diamond").rakebackPct).toBe(20);
        expect(getVipTierMeta("diamond").rank).toBeGreaterThan(getVipTierMeta("bronze").rank);
    });

    it("defaults to bronze for unknown/missing tiers", () => {
        expect(getVipTierMeta(null).label).toBe("Bronze");
        expect(getVipTierMeta(undefined).label).toBe("Bronze");
        expect(getVipTierMeta("platinumX").label).toBe("Bronze");
        expect(getVipTierMeta("").rakebackPct).toBe(0);
    });

    it("orders tiers diamond > platinum > gold > silver > bronze", () => {
        const ranks = ["bronze", "silver", "gold", "platinum", "diamond"].map(t => getVipTierMeta(t).rank);
        const sorted = [...ranks].sort((a, b) => a - b);
        expect(ranks).toEqual(sorted);
    });
});

describe("formatScaledPercent", () => {
    it("converts x100-scaled integers to a percent string", () => {
        expect(formatScaledPercent(2550)).toBe("25.50%");
        expect(formatScaledPercent(1800)).toBe("18.00%");
        expect(formatScaledPercent(0)).toBe("0.00%");
    });

    it("treats null/undefined as zero", () => {
        expect(formatScaledPercent(null)).toBe("0.00%");
        expect(formatScaledPercent(undefined)).toBe("0.00%");
    });
});
