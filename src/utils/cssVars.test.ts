import { cssVars } from "./cssVars";

describe("cssVars", () => {
    it("passes custom properties through as a style object", () => {
        const style = cssVars({ "--deal-dx": "12px", "--deal-delay": "90ms" });
        expect(style).toEqual({ "--deal-dx": "12px", "--deal-delay": "90ms" });
    });

    it("accepts an empty map", () => {
        expect(cssVars({})).toEqual({});
    });

    it("rejects keys that are not custom properties", () => {
        expect(() => cssVars({ color: "red" })).toThrow(/not a CSS custom property/);
    });
});
