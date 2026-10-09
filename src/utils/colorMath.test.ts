import { hexToRgbChannels, mixHex } from "./colorMath";

describe("hexToRgbChannels", () => {
    it("returns space-separated channels", () => {
        expect(hexToRgbChannels("#7c3aed")).toBe("124 58 237");
    });

    it("accepts upper-case hex", () => {
        expect(hexToRgbChannels("#FFFFFF")).toBe("255 255 255");
    });

    it("rejects shorthand and non-hex input", () => {
        expect(() => hexToRgbChannels("#fff")).toThrow(/6-digit hex/);
        expect(() => hexToRgbChannels("rgb(0,0,0)")).toThrow(/6-digit hex/);
    });
});

describe("mixHex", () => {
    it("returns the source at 0 and the target at 1", () => {
        expect(mixHex("#7c3aed", "#ffffff", 0)).toBe("#7c3aed");
        expect(mixHex("#7c3aed", "#ffffff", 1)).toBe("#ffffff");
    });

    it("blends linearly per channel", () => {
        expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    });

    it("rejects amounts outside 0..1", () => {
        expect(() => mixHex("#000000", "#ffffff", 1.5)).toThrow(/outside 0..1/);
    });
});
