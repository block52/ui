import {
    BLIND_STRUCTURE_CHOICES,
    DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT,
    isBlindStructureChoice,
    openingBlindsOf,
    previewBlindLevels,
    resolveBlindStructureChoice
} from "./blindStructureChoice";

const doubling = { smallBlind: 25, bigBlind: 50, durationMinutes: 10 };

describe("blind structure choice (ui#860)", () => {
    it("offers the ladder first, then doubling, the four presets and custom, with human level numbers in the labels", () => {
        expect(BLIND_STRUCTURE_CHOICES.map(c => c.value)).toEqual(["ladder", "doubling", "turbo", "standard", "deep_stack", "hyper_turbo", "custom"]);
        expect(BLIND_STRUCTURE_CHOICES[2].label).toBe("Turbo — 25/50 doubling, 5 min levels, ante from level 5");
        expect(BLIND_STRUCTURE_CHOICES[4].label).toBe("Deep Stack — 25/50 ×1.5 per level, 15 min levels, ante from level 7");
        expect(isBlindStructureChoice("hyper_turbo")).toBe(true);
        expect(isBlindStructureChoice("wsop")).toBe(false);
    });

    it("the ladder submits and previews its table from the form's blinds and level time (ui#905)", () => {
        const plan = resolveBlindStructureChoice("ladder", "", { smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
        expect(plan.error).toBeUndefined();
        expect(plan.structure).toMatchObject({ progression: "table" });
        expect(plan.preview).toBe(plan.structure);
        const rows = previewBlindLevels(plan.preview!, 8);
        expect(rows.map(r => r.bigBlind)).toEqual(["20", "40", "60", "80", "100", "150", "200", "300"]);
        expect(rows.every(r => r.durationMinutes === 10 && r.ante === "0")).toBe(true);
        expect(openingBlindsOf(plan.preview!)).toEqual({ smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
    });

    it("doubling submits nothing and previews the form's blinds doubling", () => {
        const plan = resolveBlindStructureChoice("doubling", "", doubling);
        expect(plan.structure).toBeUndefined();
        expect(plan.error).toBeUndefined();
        const rows = previewBlindLevels(plan.preview!, 3);
        expect(rows.map(r => `${r.number}:${r.smallBlind}/${r.bigBlind}/${r.ante}/${r.durationMinutes}`)).toEqual(["1:25/50/0/10", "2:50/100/0/10", "3:100/200/0/10"]);
        expect(openingBlindsOf(plan.preview!)).toEqual(doubling);
    });

    it("doubling previews the rounded levels the engine plays for a new sit-and-go (poker-vm#2738)", () => {
        const plan = resolveBlindStructureChoice("doubling", "", { smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
        const big = previewBlindLevels(plan.preview!, 9).map(r => r.bigBlind);
        // Exact doubling would be 1280, 2560, 5120: from 1,000 the big blind rounds up to two figures.
        expect(big).toEqual(["20", "40", "80", "160", "320", "640", "1300", "2600", "5200"]);
        expect(previewBlindLevels(plan.preview!, 7)[6].smallBlind).toBe("650");
    });

    it("a preset submits the preset and previews its resolved levels, antes included", () => {
        const plan = resolveBlindStructureChoice("turbo", "", doubling);
        expect(plan.structure).toEqual({ preset: "turbo" });
        const rows = previewBlindLevels(plan.preview!, 6);
        expect(rows[0]).toMatchObject({ number: 1, smallBlind: "25", bigBlind: "50", ante: "0", durationMinutes: 5 });
        expect(rows[4]).toMatchObject({ number: 5, smallBlind: "400", bigBlind: "800", ante: "80" });
        expect(openingBlindsOf(plan.preview!)).toEqual({ smallBlind: 25, bigBlind: 50, durationMinutes: 5 });
    });

    it("custom text submits the parsed structure; the default text is the turbo preset written out", () => {
        const plan = resolveBlindStructureChoice("custom", DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, doubling);
        expect(plan.error).toBeUndefined();
        expect(plan.structure).toEqual({
            progression: "double",
            startSmallBlind: "25",
            startBigBlind: "50",
            durationMinutes: 5,
            ante: { startLevel: 4, bps: 1000 },
            roundBlinds: true
        });
        const table = resolveBlindStructureChoice("custom", "BLINDS mine { duration: 20m levels { 0: 100/200 1: 150/300 ante 300 } }", doubling);
        expect(table.structure).toMatchObject({ progression: "table" });
        expect(previewBlindLevels(table.preview!, 3).map(r => r.bigBlind)).toEqual(["200", "300", "300"]);
    });

    it("custom text that does not parse yields the SDK's error and nothing to submit or preview", () => {
        const plan = resolveBlindStructureChoice("custom", "BLINDS x { start: 25/60 duration: 5m progression: double }", doubling);
        expect(plan.structure).toBeUndefined();
        expect(plan.preview).toBeUndefined();
        expect(plan.error).toContain("big blind = 2 × small blind");
    });
});
