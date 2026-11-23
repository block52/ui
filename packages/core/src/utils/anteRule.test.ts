import { expandBlindLevel, type BlindStructureDTO } from "@block52/poker-vm-sdk";
import {
    DEFAULT_ANTE_FORM,
    anteForLevel,
    anteFormFromRule,
    anteRuleFromForm,
    anteRuleOfStructure,
    applyAnteRule,
    describeAnteForm,
    describeAnteSchedule,
    formatBlindsWithAnte,
    sameAnteRule,
    validateAnteForm,
    type ConcreteBlindStructure
} from "./anteRule";
import { ladderStructure } from "./blindLadder";

const doubling: ConcreteBlindStructure = { progression: "double", startSmallBlind: "25", startBigBlind: "50", durationMinutes: 10, roundBlinds: true };

describe("ante controls ↔ ante rule (ui#891)", () => {
    it("defaults to antes on from level 4 at a full big blind", () => {
        expect(DEFAULT_ANTE_FORM).toEqual({ enabled: true, startLevel: 4, percentOfBigBlind: 100 });
        expect(anteRuleFromForm(DEFAULT_ANTE_FORM)).toEqual({ startLevel: 3, bps: 10000 });
    });

    it("maps the form to the rule: displayed level 1-based → startLevel 0-based, % → bps", () => {
        expect(anteRuleFromForm({ enabled: true, startLevel: 1, percentOfBigBlind: 10 })).toEqual({ startLevel: 0, bps: 1000 });
        expect(anteRuleFromForm({ enabled: true, startLevel: 6, percentOfBigBlind: 12.5 })).toEqual({ startLevel: 5, bps: 1250 });
        expect(anteRuleFromForm({ enabled: false, startLevel: 4, percentOfBigBlind: 100 })).toBeNull();
    });

    it("maps the rule back to the form, and no rule to off keeping the fallback's level and size", () => {
        expect(anteFormFromRule({ startLevel: 4, bps: 1000 })).toEqual({ enabled: true, startLevel: 5, percentOfBigBlind: 10 });
        expect(anteFormFromRule(null, { enabled: true, startLevel: 7, percentOfBigBlind: 50 })).toEqual({ enabled: false, startLevel: 7, percentOfBigBlind: 50 });
        expect(anteFormFromRule(undefined)).toEqual({ ...DEFAULT_ANTE_FORM, enabled: false });
    });

    it("round-trips form → rule → form", () => {
        for (const form of [DEFAULT_ANTE_FORM, { enabled: true, startLevel: 2, percentOfBigBlind: 50 }, { enabled: true, startLevel: 9, percentOfBigBlind: 12.5 }]) {
            expect(anteFormFromRule(anteRuleFromForm(form))).toEqual(form);
        }
    });

    it("validates the start level and the size", () => {
        expect(validateAnteForm(DEFAULT_ANTE_FORM)).toBeUndefined();
        expect(validateAnteForm({ enabled: false, startLevel: 0, percentOfBigBlind: 0 })).toBeUndefined();
        expect(validateAnteForm({ enabled: true, startLevel: 0, percentOfBigBlind: 100 })).toMatch(/level 1/);
        expect(validateAnteForm({ enabled: true, startLevel: 2.5, percentOfBigBlind: 100 })).toMatch(/level 1/);
        expect(validateAnteForm({ enabled: true, startLevel: 4, percentOfBigBlind: 0 })).toMatch(/more than 0%/);
        expect(validateAnteForm({ enabled: true, startLevel: 4, percentOfBigBlind: 101 })).toMatch(/at most 100%/);
        expect(validateAnteForm({ enabled: true, startLevel: 4, percentOfBigBlind: NaN })).toMatch(/more than 0%/);
        expect(validateAnteForm({ enabled: true, startLevel: 4, percentOfBigBlind: 12.345 })).toMatch(/two decimal/);
    });

    it("compares rules", () => {
        expect(sameAnteRule(null, undefined)).toBe(true);
        expect(sameAnteRule({ startLevel: 3, bps: 10000 }, { startLevel: 3, bps: 10000 })).toBe(true);
        expect(sameAnteRule({ startLevel: 3, bps: 10000 }, { startLevel: 3, bps: 5000 })).toBe(false);
        expect(sameAnteRule({ startLevel: 3, bps: 10000 }, null)).toBe(false);
    });
});

describe("applying an ante rule to a structure", () => {
    it("computes a level's ante like the engine: floor(bb × bps / 10000) from the start level", () => {
        expect(anteForLevel("400", 3, { startLevel: 3, bps: 10000 })).toBe("400");
        expect(anteForLevel("400", 2, { startLevel: 3, bps: 10000 })).toBe("0");
        expect(anteForLevel("150", 5, { startLevel: 3, bps: 1250 })).toBe("18");
        expect(anteForLevel("400", 9, null)).toBe("0");
    });

    it("an algorithmic structure carries the rule, which the SDK expands (AC-1)", () => {
        const withAnte = applyAnteRule(doubling, { startLevel: 3, bps: 10000 });
        expect(withAnte).toEqual({ ...doubling, ante: { startLevel: 3, bps: 10000 } });
        expect(expandBlindLevel(withAnte, 2).ante).toBe("0");
        expect(expandBlindLevel(withAnte, 3)).toMatchObject({ bigBlind: "400", ante: "400" });
        expect(applyAnteRule(withAnte, null)).toEqual(doubling);
    });

    it("a table structure (the ladder) gets each row's ante; breaks keep none (AC-1, AC-2)", () => {
        const ladder = ladderStructure(10, 20, 10, 8);
        const withAnte = applyAnteRule(ladder, { startLevel: 3, bps: 10000 });
        if (withAnte.progression !== "table") throw new Error("expected a table");
        expect(withAnte.levels.map(l => `${l.bigBlind}:${l.ante}`)).toEqual(["20:0", "40:0", "60:0", "80:80", "100:100", "150:150", "200:200", "300:300"]);
        const off = applyAnteRule(withAnte, null);
        if (off.progression !== "table") throw new Error("expected a table");
        expect(off.levels.every(l => l.ante === "0")).toBe(true);

        const withBreak: ConcreteBlindStructure = {
            progression: "table",
            levels: [...ladder.levels.slice(0, 2), { level: 2, smallBlind: "", bigBlind: "", ante: "", durationMinutes: 5, isBreak: true }, { ...ladder.levels[2], level: 3 }]
        };
        const applied = applyAnteRule(withBreak, { startLevel: 0, bps: 1000 });
        if (applied.progression !== "table") throw new Error("expected a table");
        expect(applied.levels.map(l => l.ante)).toEqual(["2", "4", "", "6"]);
    });
});

describe("reading the ante rule back from a structure", () => {
    it("reads an algorithmic structure's rule, a preset's after resolving it, and none", () => {
        expect(anteRuleOfStructure({ ...doubling, ante: { startLevel: 3, bps: 5000 } })).toEqual({ startLevel: 3, bps: 5000 });
        expect(anteRuleOfStructure({ preset: "turbo" })).toEqual({ startLevel: 4, bps: 1000 });
        expect(anteRuleOfStructure(doubling)).toBeNull();
    });

    it("infers a table's rule from its rows when one rule reproduces them all", () => {
        for (const rule of [{ startLevel: 3, bps: 10000 }, { startLevel: 0, bps: 5000 }, { startLevel: 5, bps: 1000 }]) {
            expect(anteRuleOfStructure(applyAnteRule(ladderStructure(10, 20, 10), rule))).toEqual(rule);
        }
        expect(anteRuleOfStructure(ladderStructure(10, 20, 10))).toBeNull();
    });

    it("calls hand-written table antes no rule reproduces custom", () => {
        const table: BlindStructureDTO = {
            progression: "table",
            levels: [
                { level: 0, smallBlind: "100", bigBlind: "200", ante: "0", durationMinutes: 10, isBreak: false },
                { level: 1, smallBlind: "200", bigBlind: "400", ante: "50", durationMinutes: 10, isBreak: false },
                { level: 2, smallBlind: "300", bigBlind: "600", ante: "600", durationMinutes: 10, isBreak: false }
            ]
        };
        expect(anteRuleOfStructure(table)).toBe("custom");
        expect(describeAnteSchedule(table)).toBe("Antes from level 2");
    });
});

describe("ante display text", () => {
    it("describes a table's antes for the lobby", () => {
        expect(describeAnteSchedule(undefined)).toBe("No antes");
        expect(describeAnteSchedule(doubling)).toBe("No antes");
        expect(describeAnteSchedule({ preset: "hyper_turbo" })).toBe("Antes from level 4");
        expect(describeAnteSchedule(applyAnteRule(ladderStructure(10, 20, 10), { startLevel: 3, bps: 10000 }))).toBe("Antes from level 4");
    });

    it("describes the controls", () => {
        expect(describeAnteForm(DEFAULT_ANTE_FORM)).toBe("From level 4 the big blind posts an ante of 100% of the big blind for the table.");
        expect(describeAnteForm({ ...DEFAULT_ANTE_FORM, enabled: false })).toBe("No antes.");
    });

    it("adds the ante to the header's blinds only when there is one", () => {
        expect(formatBlindsWithAnte("200/400", "400")).toBe("200/400 (400)");
        expect(formatBlindsWithAnte("200/400", undefined)).toBe("200/400");
        expect(formatBlindsWithAnte("", "400")).toBe("");
    });
});
