/**
 * Ante controls on the create forms (ui#891, poker-vm#2736).
 *
 * The engine plays a big-blind ante today (#2613 slice 7): from the ante level
 * on, the player in the big blind posts one ante for the whole table as dead
 * money, before their blind. A level's ante is floor(bigBlind × bps / 10000),
 * from the structure's `ante` rule (`AnteRuleDTO {startLevel, bps}`, 0-based
 * level) on an algorithmic structure, or each row's own `ante` on a table
 * structure (the ladder). This module holds the pure, unit-tested mapping
 * between the form's controls and that rule, in both directions, and applies
 * a rule to any structure.
 *
 * Level numbers in the form are 1-based ("Level 4" is the engine's level 3),
 * matching the level preview and the table's Blinds tab; everything handed to
 * the SDK stays 0-based.
 */

import { resolveBlindPreset, type AnteRuleDTO, type BlindLevelDTO, type BlindStructureDTO, type BlindStructurePresetDTO } from "@block52/poker-vm-sdk";

/** A structure with any preset resolved: what the form previews and edits. */
export type ConcreteBlindStructure = Exclude<BlindStructureDTO, BlindStructurePresetDTO>;

/** The form's ante controls. */
export interface AnteFormState {
    /** Antes on or off. */
    enabled: boolean;
    /** The first level with an ante, 1-based as displayed. */
    startLevel: number;
    /** The ante as a percentage of the big blind (100 = a full big blind). */
    percentOfBigBlind: number;
}

const BPS_PER_PERCENT = 100;
const BPS_TOTAL = 10000n;

/**
 * The form's defaults: on, from level 4, one full big blind. This is the
 * big-blind ante poker-vm#2736 proposes for the engine's current big-blind-ante
 * mechanics (the BB posts one ante for the table). If the engine moves to
 * per-player antes (10% of the big blind each, the CoinPoker model in #2736),
 * this default changes with it.
 */
export const DEFAULT_ANTE_FORM: AnteFormState = { enabled: true, startLevel: 4, percentOfBigBlind: 100 };

/** The size quick choices, in % of the big blind. 10% is what the presets post today. */
export const ANTE_PERCENT_QUICK_CHOICES: ReadonlyArray<number> = [10, 50, 100];

/** Why the controls can't be submitted, or undefined when they can. */
export function validateAnteForm(form: AnteFormState): string | undefined {
    if (!form.enabled) return undefined;
    if (!Number.isInteger(form.startLevel) || form.startLevel < 1) return "Antes must start at level 1 or later.";
    const bps = form.percentOfBigBlind * BPS_PER_PERCENT;
    if (!(form.percentOfBigBlind > 0) || form.percentOfBigBlind > 100) return "The ante must be more than 0% and at most 100% of the big blind.";
    if (Math.abs(bps - Math.round(bps)) > 1e-9) return "The ante size allows at most two decimal places.";
    return undefined;
}

/** Form → rule: the structure's `ante`, or null for no antes. The form must be valid (validateAnteForm). */
export function anteRuleFromForm(form: AnteFormState): AnteRuleDTO | null {
    if (!form.enabled) return null;
    return { startLevel: form.startLevel - 1, bps: Math.round(form.percentOfBigBlind * BPS_PER_PERCENT) };
}

/**
 * Rule → form. No rule turns antes off and keeps `fallback`'s level and size,
 * so switching antes back on restores what the user had.
 */
export function anteFormFromRule(rule: AnteRuleDTO | null | undefined, fallback: AnteFormState = DEFAULT_ANTE_FORM): AnteFormState {
    if (!rule) return { ...fallback, enabled: false };
    return { enabled: true, startLevel: rule.startLevel + 1, percentOfBigBlind: rule.bps / BPS_PER_PERCENT };
}

/** Whether two rules post the same antes (null = none). */
export function sameAnteRule(a: AnteRuleDTO | null | undefined, b: AnteRuleDTO | null | undefined): boolean {
    if (!a || !b) return !a && !b;
    return a.startLevel === b.startLevel && a.bps === b.bps;
}

/** A level's ante under a rule, exactly as the engine computes it: floor(bb × bps / 10000) from the start level. */
export function anteForLevel(bigBlind: string, level: number, rule: AnteRuleDTO | null): string {
    if (!rule || level < rule.startLevel) return "0";
    return ((BigInt(bigBlind) * BigInt(rule.bps)) / BPS_TOTAL).toString();
}

/**
 * The structure with the rule applied. An algorithmic structure carries the
 * rule as its `ante` (removed for null); a table structure writes each row's
 * ante (breaks keep none), since the engine reads table rows' own antes.
 */
export function applyAnteRule(structure: ConcreteBlindStructure, rule: AnteRuleDTO | null): ConcreteBlindStructure {
    if (structure.progression === "table") {
        const levels: BlindLevelDTO[] = structure.levels.map(row =>
            row.isBreak ? row : { ...row, ante: anteForLevel(row.bigBlind, row.level, rule) }
        );
        return { ...structure, levels };
    }
    const { ante: _previous, ...rest } = structure;
    return rule ? { ...rest, ante: { ...rule } } : rest;
}

/**
 * Structure → rule: the ante rule a structure plays, null for none, or
 * "custom" for table rows whose antes no single rule reproduces (hand-written
 * per-level antes). A preset is resolved first.
 */
export function anteRuleOfStructure(structure: BlindStructureDTO): AnteRuleDTO | null | "custom" {
    const concrete = resolveBlindPreset(structure);
    if (concrete.progression !== "table") return concrete.ante ? { ...concrete.ante } : null;

    const rows = concrete.levels.filter(r => !r.isBreak);
    const first = rows.find(r => r.ante !== "0" && r.ante !== "");
    if (!first) return null;
    // The smallest bps that gives the first ante; every row must then agree.
    const bps = Number((BigInt(first.ante) * BPS_TOTAL + BigInt(first.bigBlind) - 1n) / BigInt(first.bigBlind));
    const rule: AnteRuleDTO = { startLevel: first.level, bps };
    if (bps < 1 || bps > Number(BPS_TOTAL)) return "custom";
    return rows.every(r => anteForLevel(r.bigBlind, r.level, rule) === (r.ante === "" ? "0" : r.ante)) ? rule : "custom";
}

/** "Antes from level 4" or "No antes" for a table's structure; undefined (plain doubling) has no antes. */
export function describeAnteSchedule(structure: BlindStructureDTO | undefined): string {
    if (!structure) return "No antes";
    const rule = anteRuleOfStructure(structure);
    if (rule === null) return "No antes";
    if (rule === "custom") {
        const concrete = resolveBlindPreset(structure);
        const first = concrete.progression === "table" ? concrete.levels.find(r => !r.isBreak && r.ante !== "0" && r.ante !== "") : undefined;
        return first ? `Antes from level ${first.level + 1}` : "No antes";
    }
    return `Antes from level ${rule.startLevel + 1}`;
}

/** The form's controls as one line, e.g. "Big-blind ante of 100% of the big blind from level 4". */
export function describeAnteForm(form: AnteFormState): string {
    if (!form.enabled) return "No antes.";
    return `From level ${form.startLevel} the big blind posts an ante of ${form.percentOfBigBlind}% of the big blind for the table.`;
}

/**
 * The header's blinds text with this level's ante when there is one:
 * "200/400 (400)". No ante leaves the blinds as they are.
 */
export function formatBlindsWithAnte(blindsFormatted: string, anteFormatted: string | undefined): string {
    if (!blindsFormatted || !anteFormatted) return blindsFormatted;
    return `${blindsFormatted} (${anteFormatted})`;
}
