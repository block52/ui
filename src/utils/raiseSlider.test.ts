import { amountAtStep, sliderStepCount, sliderUnit, stepForAmount } from "./raiseSlider";

describe("raise slider grid (ui#890)", () => {
    it("moves 1¢ on cash and 1 chip in tournaments", () => {
        expect(sliderUnit(false)).toBe(0.01);
        expect(sliderUnit(true)).toBe(1);
    });

    it("starts exactly on the minimum and steps a cent at a time", () => {
        // Bet 2¢, raise to 6¢ → minimum re-raise to 10¢.
        expect(amountAtStep(0, 0.1, 1.99, false)).toBe(0.1);
        expect(amountAtStep(1, 0.1, 1.99, false)).toBe(0.11);
        expect(amountAtStep(2, 0.1, 1.99, false)).toBe(0.12);
        expect(amountAtStep(3, 0.1, 1.99, false)).toBe(0.13);
    });

    it("has no float noise", () => {
        for (let i = 0; i <= sliderStepCount(0.03, 1.99, false); i++) {
            const a = amountAtStep(i, 0.03, 1.99, false);
            expect(Math.round(a * 100) / 100).toBe(a);
        }
    });

    it("lands exactly on the maximum (all-in) at the far right, even for an odd stack", () => {
        const count = sliderStepCount(0.04, 1.99, false);
        expect(count).toBe(195);
        expect(amountAtStep(count, 0.04, 1.99, false)).toBe(1.99);
        // A stack that isn't a whole number of cents above the minimum.
        const odd = sliderStepCount(0.04, 1.234567, false);
        expect(amountAtStep(odd, 0.04, 1.234567, false)).toBe(1.234567);
        expect(amountAtStep(odd - 1, 0.04, 1.234567, false)).toBe(1.23);
    });

    it("tournaments step whole chips up to the stack", () => {
        const count = sliderStepCount(100, 1525, true);
        expect(count).toBe(1425);
        expect(amountAtStep(1, 100, 1525, true)).toBe(101);
        expect(amountAtStep(count, 100, 1525, true)).toBe(1525);
    });

    it("maps an amount back to its position, clamped to the range", () => {
        expect(stepForAmount(0.1, 0.1, 1.99, false)).toBe(0);
        expect(stepForAmount(0.13, 0.1, 1.99, false)).toBe(3);
        expect(stepForAmount(0.05, 0.1, 1.99, false)).toBe(0);
        expect(stepForAmount(1.99, 0.1, 1.99, false)).toBe(sliderStepCount(0.1, 1.99, false));
        expect(stepForAmount(5, 0.1, 1.99, false)).toBe(sliderStepCount(0.1, 1.99, false));
        // Just below an odd max stays on the last whole cent, not the max.
        const count = sliderStepCount(0.04, 1.234567, false);
        expect(stepForAmount(1.23, 0.04, 1.234567, false)).toBe(count - 1);
    });

    it("has no range when min equals max (fixed-limit or short shove)", () => {
        expect(sliderStepCount(0.5, 0.5, false)).toBe(0);
        expect(amountAtStep(3, 0.5, 0.5, false)).toBe(0.5);
        expect(stepForAmount(0.5, 0.5, 0.5, false)).toBe(0);
    });
});
