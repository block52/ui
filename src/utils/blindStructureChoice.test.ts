import { parseBlindStructure } from "@block52/poker-vm-sdk";
import { DEFAULT_ANTE_FORM } from "./anteRule";
import {
    BLIND_STRUCTURE_CHOICES,
    anteFormForChoice,
    anteFormOfCustomText,
    customTextFromPlan,
    customTextWithAnte,
    DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT,
    isBlindStructureChoice,
    openingBlindsOf,
    previewBlindLevels,
    previewHasAnte,
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

describe("ante controls on the create form (ui#891)", () => {
    const off = { ...DEFAULT_ANTE_FORM, enabled: false };
    const ladderBlinds = { smallBlind: 10, bigBlind: 20, durationMinutes: 10 };

    it("AC-1: antes on, level 4, 100% gives the ladder an ante equal to the big blind from level 4", () => {
        const plan = resolveBlindStructureChoice("ladder", "", ladderBlinds, DEFAULT_ANTE_FORM);
        expect(plan.error).toBeUndefined();
        expect(plan.preview).toBe(plan.structure);
        const rows = previewBlindLevels(plan.preview!, 6);
        expect(rows.map(r => `${r.number}:${r.bigBlind}/${r.ante}`)).toEqual(["1:20/0", "2:40/0", "3:60/0", "4:80/80", "5:100/100", "6:150/150"]);
    });

    it("AC-2: antes off submits a structure with no ante", () => {
        const ladder = resolveBlindStructureChoice("ladder", "", ladderBlinds, off);
        expect(previewBlindLevels(ladder.preview!, 30).every(r => r.ante === "0")).toBe(true);
        const doublingOff = resolveBlindStructureChoice("doubling", "", doubling, off);
        expect(doublingOff.structure).toBeUndefined();
        const turboOff = resolveBlindStructureChoice("turbo", "", doubling, off);
        expect(turboOff.structure).toMatchObject({ progression: "double", startBigBlind: "50" });
        expect(turboOff.structure).not.toHaveProperty("ante");
        expect(previewBlindLevels(turboOff.preview!, 10).every(r => r.ante === "0")).toBe(true);
    });

    it("the preview shows its Ante column only when a level has an ante", () => {
        expect(previewHasAnte(previewBlindLevels(resolveBlindStructureChoice("ladder", "", ladderBlinds, DEFAULT_ANTE_FORM).preview!, 10))).toBe(true);
        expect(previewHasAnte(previewBlindLevels(resolveBlindStructureChoice("ladder", "", ladderBlinds, off).preview!, 10))).toBe(false);
        // Antes from level 12 are past a 10-level preview.
        const late = resolveBlindStructureChoice("ladder", "", ladderBlinds, { ...DEFAULT_ANTE_FORM, startLevel: 12 });
        expect(previewHasAnte(previewBlindLevels(late.preview!, 10))).toBe(false);
    });

    it("AC-3: the start level and size change the preview", () => {
        const at2Half = resolveBlindStructureChoice("ladder", "", ladderBlinds, { enabled: true, startLevel: 2, percentOfBigBlind: 50 });
        expect(previewBlindLevels(at2Half.preview!, 4).map(r => r.ante)).toEqual(["0", "20", "30", "40"]);
    });

    it("doubling with antes submits the rounded doubling structure with the rule", () => {
        const plan = resolveBlindStructureChoice("doubling", "", doubling, DEFAULT_ANTE_FORM);
        expect(plan.structure).toEqual({
            progression: "double",
            startSmallBlind: "25",
            startBigBlind: "50",
            durationMinutes: 10,
            roundBlinds: true,
            ante: { startLevel: 3, bps: 10000 }
        });
        expect(previewBlindLevels(plan.preview!, 5).map(r => r.ante)).toEqual(["0", "0", "0", "400", "800"]);
    });

    it("a preset keeps its name while the controls match it, and submits its levels with the new rule otherwise", () => {
        const turboForm = anteFormForChoice("turbo", DEFAULT_ANTE_FORM, "", "ladder");
        expect(turboForm).toEqual({ enabled: true, startLevel: 5, percentOfBigBlind: 10 });
        expect(resolveBlindStructureChoice("turbo", "", doubling, turboForm).structure).toEqual({ preset: "turbo" });
        const changed = resolveBlindStructureChoice("turbo", "", doubling, { ...turboForm, percentOfBigBlind: 100 });
        expect(changed.structure).toMatchObject({ progression: "double", ante: { startLevel: 4, bps: 10000 } });
        expect(previewBlindLevels(changed.preview!, 5)[4]).toMatchObject({ bigBlind: "800", ante: "800" });
    });

    it("invalid controls block the plan with a message", () => {
        const plan = resolveBlindStructureChoice("ladder", "", ladderBlinds, { enabled: true, startLevel: 0, percentOfBigBlind: 100 });
        expect(plan.structure).toBeUndefined();
        expect(plan.error).toMatch(/level 1/);
    });

    it("the ladder and doubling keep the controls; leaving custom takes the text's antes", () => {
        const mine = { enabled: true, startLevel: 3, percentOfBigBlind: 50 };
        expect(anteFormForChoice("ladder", mine, "", "turbo")).toEqual(mine);
        expect(anteFormForChoice("doubling", mine, "", "ladder")).toEqual(mine);
        expect(anteFormForChoice("ladder", mine, DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, "custom")).toEqual({ enabled: true, startLevel: 5, percentOfBigBlind: 10 });
        expect(anteFormForChoice("ladder", mine, "not a structure", "custom")).toEqual(mine);
    });

    it("custom text and the controls stay in sync both ways", () => {
        expect(anteFormOfCustomText(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, DEFAULT_ANTE_FORM)).toEqual({ form: { enabled: true, startLevel: 5, percentOfBigBlind: 10 }, custom: false });
        expect(anteFormOfCustomText("nope", DEFAULT_ANTE_FORM)).toBeUndefined();

        const rewritten = customTextWithAnte(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, DEFAULT_ANTE_FORM)!;
        expect(rewritten).toContain("ante: level >= 3 ? bb : 0");
        expect(anteFormOfCustomText(rewritten, off)!.form).toEqual(DEFAULT_ANTE_FORM);

        const none = customTextWithAnte(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, off)!;
        expect(none).not.toContain("ante");
        expect(anteFormOfCustomText(none, DEFAULT_ANTE_FORM)!.form).toEqual({ ...DEFAULT_ANTE_FORM, enabled: false });

        expect(customTextWithAnte("BLINDS turbo", DEFAULT_ANTE_FORM)).toContain("BLINDS custom {");
        expect(customTextWithAnte("nope", DEFAULT_ANTE_FORM)).toBeUndefined();
        expect(customTextWithAnte(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT, { ...DEFAULT_ANTE_FORM, startLevel: 0 })).toBeUndefined();

        const handWritten = "BLINDS mine { levels { 0: 100/200 duration 10m 1: 200/400 ante 50 duration 10m 2: 300/600 ante 600 duration 10m } }";
        expect(anteFormOfCustomText(handWritten, DEFAULT_ANTE_FORM)).toEqual({ form: DEFAULT_ANTE_FORM, custom: true });
    });

    it("switching to custom writes out the structure the form had, antes included", () => {
        const plan = resolveBlindStructureChoice("doubling", "", doubling, DEFAULT_ANTE_FORM);
        const text = customTextFromPlan(plan)!;
        expect(parseBlindStructure(text)).toEqual(plan.structure);
        expect(customTextFromPlan(resolveBlindStructureChoice("turbo", "", doubling))).toContain("ante: level >= 4 ? bb * 0.1 : 0");
        expect(customTextFromPlan({ error: "x" })).toBeUndefined();
    });
});
