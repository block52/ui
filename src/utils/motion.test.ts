import { prefersReducedMotion } from "./motion";

describe("prefersReducedMotion", () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it("is false when matchMedia is unavailable (jsdom)", () => {
        // jsdom ships no matchMedia; make the precondition explicit.
        Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
        expect(prefersReducedMotion()).toBe(false);
    });

    it("reflects the reduce media query", () => {
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: query === "(prefers-reduced-motion: reduce)",
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn()
        }));
        expect(prefersReducedMotion()).toBe(true);
        expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    });
});
