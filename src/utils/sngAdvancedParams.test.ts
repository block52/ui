import {
    parseAdvancedSngParams,
    buildSngPreview,
    mergeAdvancedParams,
    SNG_PREVIEW_LEVEL_COUNT,
    type SngPreviewInput
} from "./sngAdvancedParams";

const BASE: SngPreviewInput = {
    maxPlayers: 6,
    buyIn: 10,
    startingStack: 1500,
    smallBlind: 25,
    bigBlind: 50,
    blindLevelDuration: 10
};

describe("parseAdvancedSngParams", () => {
    it("parses a valid full object", () => {
        const result = parseAdvancedSngParams(JSON.stringify(BASE));
        expect(result.isValid).toBe(true);
        if (!result.isValid) throw new Error("expected valid");
        expect(result.errors).toEqual([]);
        expect(result.params).toEqual(BASE);
    });

    it("parses a partial object", () => {
        const result = parseAdvancedSngParams("{ \"startingStack\": 3000 }");
        expect(result.isValid).toBe(true);
        if (!result.isValid) throw new Error("expected valid");
        expect(result.params).toEqual({ startingStack: 3000 });
    });

    it("rejects empty input", () => {
        const result = parseAdvancedSngParams("   ");
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects invalid JSON", () => {
        const result = parseAdvancedSngParams("{ not json }");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Invalid JSON/);
    });

    it("rejects a JSON array", () => {
        const result = parseAdvancedSngParams("[1, 2, 3]");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/must be a JSON object/);
    });

    it("rejects null", () => {
        const result = parseAdvancedSngParams("null");
        expect(result.isValid).toBe(false);
    });

    it("rejects unknown fields", () => {
        const result = parseAdvancedSngParams("{ \"startingstack\": 1500 }");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Unknown field/);
    });

    it("rejects non-numeric values", () => {
        const result = parseAdvancedSngParams("{ \"startingStack\": \"1500\" }");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/must be a number/);
    });

    it("rejects zero and negative values", () => {
        expect(parseAdvancedSngParams("{ \"buyIn\": 0 }").isValid).toBe(false);
        expect(parseAdvancedSngParams("{ \"buyIn\": -5 }").isValid).toBe(false);
    });

    it("rejects invalid runner counts", () => {
        const result = parseAdvancedSngParams("{ \"maxPlayers\": 3 }");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/maxPlayers/);
    });

    it("accepts each valid runner count", () => {
        for (const n of [2, 4, 6, 9]) {
            expect(parseAdvancedSngParams(`{ "maxPlayers": ${n} }`).isValid).toBe(true);
        }
    });

    it("rejects smallBlind >= bigBlind", () => {
        const result = parseAdvancedSngParams("{ \"smallBlind\": 50, \"bigBlind\": 50 }");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/smallBlind/);
    });

    it("rejects non-integer startingStack and blindLevelDuration", () => {
        expect(parseAdvancedSngParams("{ \"startingStack\": 1500.5 }").isValid).toBe(false);
        expect(parseAdvancedSngParams("{ \"blindLevelDuration\": 10.5 }").isValid).toBe(false);
    });

    it("collects multiple errors at once", () => {
        const result = parseAdvancedSngParams("{ \"maxPlayers\": 3, \"buyIn\": -1 }");
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("allows a fractional buyIn (dollars)", () => {
        const result = parseAdvancedSngParams("{ \"buyIn\": 10.5 }");
        expect(result.isValid).toBe(true);
        if (!result.isValid) throw new Error("expected valid");
        expect(result.params.buyIn).toBe(10.5);
    });
});

describe("mergeAdvancedParams", () => {
    it("overrides only provided fields", () => {
        const merged = mergeAdvancedParams(BASE, { startingStack: 3000, maxPlayers: 9 });
        expect(merged.startingStack).toBe(3000);
        expect(merged.maxPlayers).toBe(9);
        expect(merged.buyIn).toBe(BASE.buyIn);
        expect(merged.smallBlind).toBe(BASE.smallBlind);
    });

    it("returns base values when params are empty", () => {
        expect(mergeAdvancedParams(BASE, {})).toEqual(BASE);
    });
});

describe("buildSngPreview", () => {
    it("computes runners, stack, buy-in and total chips", () => {
        const preview = buildSngPreview(BASE);
        expect(preview.runners).toBe(6);
        expect(preview.startingStack).toBe(1500);
        expect(preview.buyIn).toBe(10);
        expect(preview.totalChipsInPlay).toBe(9000);
    });

    it("produces the expected number of doubling blind levels", () => {
        const preview = buildSngPreview(BASE);
        expect(preview.levels).toHaveLength(SNG_PREVIEW_LEVEL_COUNT);
        expect(preview.levels[0]).toMatchObject({ level: 1, smallBlind: 25, bigBlind: 50, durationMinutes: 10 });
        expect(preview.levels[1]).toMatchObject({ level: 2, smallBlind: 50, bigBlind: 100 });
        expect(preview.levels[2]).toMatchObject({ level: 3, smallBlind: 100, bigBlind: 200 });
    });

    it("previews the form's antes when the ante controls are given (ui#891)", () => {
        const on = buildSngPreview({ ...BASE, blindStructureChoice: "doubling", anteForm: { enabled: true, startLevel: 2, percentOfBigBlind: 100 } });
        expect(on.levels.slice(0, 3).map(l => l.ante)).toEqual([0, 100, 200]);
        const off = buildSngPreview({ ...BASE, blindStructureChoice: "turbo", anteForm: { enabled: false, startLevel: 4, percentOfBigBlind: 100 } });
        expect(off.levels.every(l => l.ante === 0)).toBe(true);
    });
});
