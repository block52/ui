import { presetExceedsMax } from "./potPresetLimits";

describe("presetExceedsMax (ui#857)", () => {
    it("is false when the preset fits under the max", () => {
        expect(presetExceedsMax(560_000n, 0.59, false)).toBe(false); // $0.56 vs $0.59
    });

    it("is false when the preset equals the max exactly", () => {
        expect(presetExceedsMax(590_000n, 0.59, false)).toBe(false);
    });

    it("is true when the preset is above the max", () => {
        expect(presetExceedsMax(770_000n, 0.59, false)).toBe(true); // $0.77 vs $0.59
    });

    it("judges the unrounded amount, so a pot-limit cap off the cent grid is not exceeded", () => {
        // Pot = cap = $1.235; rounded to the cent it shows $1.24, but the true size fits.
        expect(presetExceedsMax(1_235_000n, 1.235, false)).toBe(false);
    });

    it("uses whole chips in tournaments", () => {
        expect(presetExceedsMax(1500n, 1500, true)).toBe(false);
        expect(presetExceedsMax(1501n, 1500, true)).toBe(true);
    });
});
