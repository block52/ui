import { colors, generateCSSVariables, hexToRgba, resolveHexColor } from "./colorConfig";

describe("resolveHexColor", () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("keeps a valid 6-digit or 3-digit hex value", () => {
        expect(resolveHexColor("X", "#abcdef", "#000000")).toBe("#abcdef");
        expect(resolveHexColor("X", "#fff", "#000000")).toBe("#fff");
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("uses the fallback silently when the variable is unset or empty", () => {
        expect(resolveHexColor("X", undefined, "#111111")).toBe("#111111");
        expect(resolveHexColor("X", "", "#111111")).toBe("#111111");
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("falls back and names the variable when the value is not hex", () => {
        expect(resolveHexColor("VITE_BRAND_COLOR_PRIMARY", "rebeccapurple", "#7c3aed")).toBe("#7c3aed");
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("VITE_BRAND_COLOR_PRIMARY"));
    });
});

describe("colors", () => {
    it("exposes the default brand colour when no env override is set", () => {
        expect(colors.brand.primary).toBe("#7c3aed");
    });
});

describe("generateCSSVariables", () => {
    it("emits dark defaults and a light-theme override block", () => {
        const css = generateCSSVariables();
        expect(css).toContain("--brand-primary-rgb: 124 58 237");
        expect(css).toContain(':root[data-theme="light"]');
        expect(css).toContain("--ui-bg-dark: #ffffff");
    });
});

describe("hexToRgba", () => {
    it("is re-exported and strict", () => {
        expect(hexToRgba("#7c3aed", 0.1)).toBe("rgba(124, 58, 237, 0.1)");
        expect(() => hexToRgba("", 0.1)).toThrow();
    });
});
