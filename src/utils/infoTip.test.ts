import { placeTip, pointerCanHover, tipOpenAfter, TIP_MARGIN, TIP_MAX_WIDTH } from "./infoTip";

const view = { width: 390, height: 700 };

describe("pointerCanHover", () => {
    it("treats a fine pointer as hoverable and anything else as a finger", () => {
        expect(pointerCanHover(true)).toBe(true);
        expect(pointerCanHover(false)).toBe(false);
        expect(pointerCanHover(undefined)).toBe(false);
    });
});

describe("tipOpenAfter", () => {
    it("opens on hover and focus for a mouse, and does not toggle shut on click", () => {
        expect(tipOpenAfter(false, "hover-in", true)).toBe(true);
        expect(tipOpenAfter(true, "hover-out", true)).toBe(false);
        expect(tipOpenAfter(false, "focus", true)).toBe(true);
        expect(tipOpenAfter(true, "blur", true)).toBe(false);
        expect(tipOpenAfter(true, "click", true)).toBe(true);
        expect(tipOpenAfter(false, "click", true)).toBe(false);
    });

    it("toggles on a tap and ignores hover for a finger", () => {
        expect(tipOpenAfter(false, "click", false)).toBe(true);
        expect(tipOpenAfter(true, "click", false)).toBe(false);
        expect(tipOpenAfter(false, "hover-in", false)).toBe(false);
        expect(tipOpenAfter(true, "hover-out", false)).toBe(true);
        expect(tipOpenAfter(false, "focus", false)).toBe(false);
    });

    it("closes on Escape and on a tap outside, whichever pointer it is", () => {
        expect(tipOpenAfter(true, "escape", true)).toBe(false);
        expect(tipOpenAfter(true, "outside", false)).toBe(false);
        expect(tipOpenAfter(false, "escape", false)).toBe(false);
    });
});

describe("placeTip", () => {
    const anchor = { top: 120, left: 40, width: 16, height: 16 };

    it("hangs the bubble above the icon, centered on it", () => {
        const placed = placeTip({ top: 200, left: 700, width: 16, height: 16 }, 80, { width: 1440, height: 900 });
        expect(placed.width).toBe(TIP_MAX_WIDTH);
        expect(placed.top).toBe(200 - 6 - 80);
        expect(placed.left).toBe(700 + 8 - TIP_MAX_WIDTH / 2);
    });

    it("drops below the icon when the top edge is too close", () => {
        const high = { ...anchor, top: 10, left: 700 };
        const placed = placeTip(high, 80, { width: 1440, height: 900 });
        expect(placed.top).toBe(10 + 16 + 6);
    });

    it("shifts a bubble that would hang off the right of a phone", () => {
        const right = { top: 80, left: 340, width: 16, height: 16 };
        const placed = placeTip(right, 60, view);
        expect(placed.left + placed.width).toBeLessThanOrEqual(view.width - TIP_MARGIN);
        expect(placed.left).toBeGreaterThanOrEqual(TIP_MARGIN);
    });

    it("shifts a bubble that would hang off the left", () => {
        const left = { top: 80, left: 0, width: 12, height: 16 };
        const placed = placeTip(left, 40, view);
        expect(placed.left).toBe(TIP_MARGIN);
    });

    it("narrows the bubble to the viewport", () => {
        const placed = placeTip(anchor, 40, { width: 200, height: 400 });
        expect(placed.width).toBe(200 - TIP_MARGIN * 2);
        expect(placed.left).toBe(TIP_MARGIN);
    });
});
