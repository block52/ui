import { hexToRgbChannels, hexToRgba, mixHex, parseHex } from "./colorMath";

describe("hexToRgbChannels", () => {
    it("returns space-separated channels", () => {
        expect(hexToRgbChannels("#7c3aed")).toBe("124 58 237");
    });

    it("accepts upper-case hex", () => {
        expect(hexToRgbChannels("#FFFFFF")).toBe("255 255 255");
    });

    it("expands 3-digit shorthand", () => {
        expect(hexToRgbChannels("#fff")).toBe("255 255 255");
        expect(hexToRgbChannels("#1a2")).toBe("17 170 34");
    });

    it("rejects non-hex input", () => {
        expect(() => hexToRgbChannels("rgb(0,0,0)")).toThrow(/hex colour/);
        expect(() => hexToRgbChannels("rebeccapurple")).toThrow(/hex colour/);
        expect(() => hexToRgbChannels("#12345")).toThrow(/hex colour/);
        expect(() => hexToRgbChannels("")).toThrow(/hex colour/);
    });
});

describe("parseHex", () => {
    it("returns numeric channels", () => {
        expect(parseHex("#7c3aed")).toEqual([124, 58, 237]);
        expect(parseHex("#F0a")).toEqual([255, 0, 170]);
    });
});

describe("hexToRgba", () => {
    it("builds an rgba string", () => {
        expect(hexToRgba("#7c3aed", 0.5)).toBe("rgba(124, 58, 237, 0.5)");
        expect(hexToRgba("#000", 1)).toBe("rgba(0, 0, 0, 1)");
    });

    it("throws instead of returning transparent black for invalid input", () => {
        expect(() => hexToRgba("nope", 0.5)).toThrow(/hex colour/);
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
