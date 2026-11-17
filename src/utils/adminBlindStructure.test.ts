/**
 * /admin/tables blind structure (ui#905, ui#906): the admin create form sends
 * the same structure as the lobby modal, and its previews (form + advanced
 * modal) show the levels the engine will play instead of raw doubling.
 */
import { describeBlindStructureChoice, resolveBlindStructureChoice, sngBlindFields } from "@block52/poker-ui-core/utils/blindStructureChoice";
import { buildSngPreview } from "./sngAdvancedParams";
import { ladderStructure } from "@block52/poker-ui-core/utils/blindLadder";

const base = { maxPlayers: 9, buyIn: 10, startingStack: 1500, smallBlind: 10, bigBlind: 20, blindLevelDuration: 10 };

describe("sngBlindFields", () => {
    it("sends the ladder table structure by default (10/20, 10 min)", () => {
        const plan = resolveBlindStructureChoice("ladder", "", { smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
        const fields = sngBlindFields(plan, 10);
        expect(fields.blindLevelDuration).toBe(10);
        expect(fields.blindStructure).toEqual(ladderStructure(10, 20, 10));
        expect(fields.blindStructure).toMatchObject({ progression: "table" });
    });

    it("sends no structure for doubling (the engine rounds it, poker-vm#2738)", () => {
        const plan = resolveBlindStructureChoice("doubling", "", { smallBlind: 25, bigBlind: 50, durationMinutes: 5 });
        expect(sngBlindFields(plan, 5)).toEqual({ blindLevelDuration: 5 });
    });

    it("sends a preset and takes its level time", () => {
        const plan = resolveBlindStructureChoice("turbo", "", { smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
        const fields = sngBlindFields(plan, 10);
        expect(fields.blindStructure).toEqual({ preset: "turbo" });
        expect(fields.blindLevelDuration).toBe(plan.preview && "durationMinutes" in plan.preview ? plan.preview.durationMinutes : NaN);
    });

    it("falls back to the form's level time when custom text does not parse", () => {
        const plan = resolveBlindStructureChoice("custom", "not a structure", { smallBlind: 10, bigBlind: 20, durationMinutes: 10 });
        expect(plan.error).toBeDefined();
        expect(sngBlindFields(plan, 15)).toEqual({ blindLevelDuration: 15 });
    });
});

describe("buildSngPreview follows the chosen structure", () => {
    it("ladder from 10/20 reaches 75/150 at level 6", () => {
        const p = buildSngPreview({ ...base, blindStructureChoice: "ladder" });
        expect(p.levels[0]).toMatchObject({ level: 1, smallBlind: 10, bigBlind: 20 });
        expect(p.levels[5]).toMatchObject({ level: 6, smallBlind: 75, bigBlind: 150 });
        expect(p.levels[9]).toMatchObject({ level: 10, smallBlind: 300, bigBlind: 600 });
        expect(p.structureNote).toBe(describeBlindStructureChoice("ladder"));
    });

    it("doubling from 10/20 is rounded: 650/1,300 at level 7, not 640/1,280", () => {
        const p = buildSngPreview({ ...base, blindStructureChoice: "doubling" });
        expect(p.levels[6]).toMatchObject({ level: 7, smallBlind: 650, bigBlind: 1300 });
    });

    it("defaults to rounded doubling when no structure is given", () => {
        expect(buildSngPreview(base).levels[6]).toMatchObject({ smallBlind: 650, bigBlind: 1300 });
    });

    it("carries the preset's antes", () => {
        const p = buildSngPreview({ ...base, blindStructureChoice: "turbo" });
        expect(p.levels.some(l => l.ante > 0)).toBe(true);
    });

    it("has no levels for unparseable custom text", () => {
        expect(buildSngPreview({ ...base, blindStructureChoice: "custom", customBlindText: "nope" }).levels).toEqual([]);
    });
});
