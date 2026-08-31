import { hasValue, isNullish, isEmpty, hasElements, safeLength, isBlank, hasContent } from "./guards";

describe("hasValue / isNullish", () => {
    it.each([null, undefined])("treats %s as nullish", value => {
        expect(hasValue(value)).toBe(false);
        expect(isNullish(value)).toBe(true);
    });

    it.each([0, "", false, [], {}])("treats %s as a value", value => {
        expect(hasValue(value)).toBe(true);
        expect(isNullish(value)).toBe(false);
    });
});

describe("isEmpty / hasElements", () => {
    it.each([null, undefined, []])("treats %s as empty", arr => {
        expect(isEmpty(arr as unknown[] | null | undefined)).toBe(true);
        expect(hasElements(arr as unknown[] | null | undefined)).toBe(false);
    });

    it("treats a non-empty array as having elements", () => {
        expect(isEmpty([1])).toBe(false);
        expect(hasElements([1])).toBe(true);
    });
});

describe("safeLength", () => {
    it.each([null, undefined])("returns 0 for %s", arr => {
        expect(safeLength(arr as unknown[] | null | undefined)).toBe(0);
    });

    it("returns 0 for an empty array", () => {
        expect(safeLength([])).toBe(0);
    });

    it("returns the element count", () => {
        expect(safeLength([1, 2, 3])).toBe(3);
    });

    it("distinguishes counts that isEmpty/hasElements cannot (the reason it exists)", () => {
        // Both are non-empty, but safeLength changes when a new element lands.
        expect(safeLength([1, 2, 3, 4, 5])).not.toBe(safeLength([1, 2, 3, 4, 5, 6]));
    });
});

describe("isBlank / hasContent", () => {
    it.each([null, undefined, ""])("treats %s as blank", value => {
        expect(isBlank(value)).toBe(true);
        expect(hasContent(value)).toBe(false);
    });

    it("treats a non-empty string as having content", () => {
        expect(isBlank("x")).toBe(false);
        expect(hasContent("x")).toBe(true);
    });
});
