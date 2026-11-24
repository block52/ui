import { truncateMiddle } from "./stringUtils";

describe("truncateMiddle", () => {
    it("keeps the first startChars and last endChars joined by the default separator", () => {
        expect(truncateMiddle("b521rg9q8h7j6k5fj9p", 6, 4)).toBe("b521rg...fj9p");
    });

    it("supports an asymmetric split", () => {
        expect(truncateMiddle("0123456789abcdef", 4, 2)).toBe("0123...ef");
    });

    it("supports a custom separator", () => {
        expect(truncateMiddle("0123456789abcdef", 10, 8, "…")).toBe("0123456789…89abcdef");
    });

    it("returns '' for null, undefined, or empty input", () => {
        expect(truncateMiddle(null, 6, 4)).toBe("");
        expect(truncateMiddle(undefined, 6, 4)).toBe("");
        expect(truncateMiddle("", 6, 4)).toBe("");
    });

    it("does not short-circuit short strings (slices may overlap, matching prior behaviour)", () => {
        // "abcd".slice(0, 6) === "abcd", "abcd".slice(-4) === "abcd"
        expect(truncateMiddle("abcd", 6, 4)).toBe("abcd...abcd");
    });
});
