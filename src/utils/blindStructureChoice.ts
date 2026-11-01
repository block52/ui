/**
 * Blind structure choice on the Create Sit & Go form (ui#860, poker-vm#1734).
 *
 * The form offers "Ladder" (the default, ui#905: pick the opening blinds and
 * the minutes per level; the blinds climb a round-number ladder, see
 * blindLadder.ts), "Doubling" (pick the same; the blinds double every level),
 * the four engine presets, or a custom structure written in the SDK's text form. This module
 * holds the pure, unit-tested logic: which structure (if any) is submitted,
 * which resolved structure the level preview expands, and the opening blinds
 * the rest of the form (creation fee, submitted small/big blind) reads.
 *
 * Level numbers shown to players are 1-based ("Level 1" is the engine's level
 * 0); everything handed to the SDK stays 0-based.
 */

import {
    AnteRuleDTO,
    BLIND_PRESETS,
    BlindLevelDTO,
    BlindPreset,
    BlindStructureDTO,
    expandBlindLevel,
    formatBlindStructure,
    parseBlindStructure,
    resolveBlindPreset
} from "@block52/poker-vm-sdk";
import { ladderStructure } from "./blindLadder";
import {
    anteFormFromRule,
    anteRuleFromForm,
    anteRuleOfStructure,
    applyAnteRule,
    sameAnteRule,
    validateAnteForm,
    type AnteFormState,
    type ConcreteBlindStructure
} from "./anteRule";

export type BlindStructureChoice = "ladder" | "doubling" | BlindPreset | "custom";

export interface BlindStructureChoiceOption {
    value: BlindStructureChoice;
    label: string;
}

function presetLabel(preset: BlindPreset): string {
    const s = resolveBlindPreset({ preset });
    if (s.progression === "table") return preset;
    const curve = s.progression === "percentage" ? ` ×${(s.factorBps / 10000).toString()} per level` : " doubling";
    const ante = s.ante ? `, ante from level ${s.ante.startLevel + 1}` : "";
    return `${s.startSmallBlind}/${s.startBigBlind}${curve}, ${s.durationMinutes} min levels${ante}`;
}

const PRESET_NAMES: Record<BlindPreset, string> = {
    turbo: "Turbo",
    standard: "Standard",
    deep_stack: "Deep Stack",
    hyper_turbo: "Hyper Turbo"
};

export const BLIND_STRUCTURE_CHOICES: ReadonlyArray<BlindStructureChoiceOption> = [
    { value: "ladder", label: "Ladder — blinds climb 20, 40, 60, 80, 100, 150, 200, 300… (choose the opening blinds and level time)" },
    { value: "doubling", label: "Doubling — blinds double every level (choose the opening blinds and level time)" },
    ...BLIND_PRESETS.map(preset => ({ value: preset, label: `${PRESET_NAMES[preset]} — ${presetLabel(preset)}` })),
    { value: "custom", label: "Custom — write a blind structure" }
];

export function isBlindStructureChoice(value: string): value is BlindStructureChoice {
    return BLIND_STRUCTURE_CHOICES.some(c => c.value === value);
}

/** What the custom textarea starts with: the turbo preset written out. */
/** The structure both create forms open with (ui#905). */
export const DEFAULT_BLIND_STRUCTURE_CHOICE: BlindStructureChoice = "ladder";

export const DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT = formatBlindStructure(resolveBlindPreset({ preset: "turbo" }), "custom");

export interface DoublingBlinds {
    smallBlind: number; // chips
    bigBlind: number; // chips
    durationMinutes: number;
}

export interface BlindPlan {
    /** What `createGame` sends; undefined keeps the chain's doubling. */
    structure?: BlindStructureDTO;
    /** The resolved structure the preview expands; undefined when custom text does not parse. */
    preview?: BlindStructureDTO;
    /** The parse error for custom text, verbatim from the SDK. */
    error?: string;
}

/**
 * Resolves the form's choice into the structure to submit and the structure to
 * preview. The ladder submits and previews its table structure. Doubling previews as a rounded `double` structure built from the
 * form's blinds but submits nothing: the engine adopts that same structure for
 * a plain sit-and-go that has not started (poker-vm#2738).
 *
 * `ante` is the form's ante controls (ui#891). Omitted, every choice keeps its
 * own antes (the ladder and doubling have none, a preset has its own). Given,
 * the controls decide the antes of the ladder, doubling and the presets:
 * doubling with antes then submits the same rounded `double` structure with
 * the ante rule (the engine only adopts a structure without one), and a preset
 * whose antes were changed submits its resolved structure with the new rule
 * (a preset by name takes no other field). Custom text carries its own antes;
 * the controls rewrite the text instead (customTextWithAnte).
 */
export function resolveBlindStructureChoice(choice: BlindStructureChoice, customText: string, doubling: DoublingBlinds, ante?: AnteFormState): BlindPlan {
    if (choice === "custom") {
        try {
            const structure = parseBlindStructure(customText);
            return { structure, preview: resolveBlindPreset(structure) };
        } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }
    const anteError = ante ? validateAnteForm(ante) : undefined;
    if (anteError) return { error: anteError };
    const rule = ante ? anteRuleFromForm(ante) : undefined;

    if (choice === "ladder") {
        const ladder = ladderStructure(doubling.smallBlind, doubling.bigBlind, doubling.durationMinutes);
        const structure = rule === undefined ? ladder : applyAnteRule(ladder, rule);
        return { structure, preview: structure };
    }
    if (choice === "doubling") {
        const preview: ConcreteBlindStructure = {
            progression: "double",
            startSmallBlind: String(doubling.smallBlind),
            startBigBlind: String(doubling.bigBlind),
            durationMinutes: doubling.durationMinutes,
            roundBlinds: true
        };
        if (!rule) return { preview };
        const structure = applyAnteRule(preview, rule);
        return { structure, preview: structure };
    }
    const preset: BlindStructureDTO = { preset: choice };
    const resolved = resolveBlindPreset(preset);
    if (rule === undefined || sameAnteRule(presetAnteRule(choice), rule)) {
        return { structure: preset, preview: resolved };
    }
    const structure = applyAnteRule(resolved, rule);
    return { structure, preview: structure };
}

/** A preset's own ante rule (null for none). Presets are algorithmic, so their rule is never per-level custom. */
export function presetAnteRule(preset: BlindPreset): AnteRuleDTO | null {
    const rule = anteRuleOfStructure({ preset });
    return rule === "custom" ? null : rule;
}

/**
 * The ante controls after choosing a structure: a preset fills them from the
 * preset's own rule; leaving custom takes what the custom text plays; the
 * ladder and doubling keep the current controls.
 */
export function anteFormForChoice(choice: BlindStructureChoice, current: AnteFormState, customText: string, previousChoice: BlindStructureChoice): AnteFormState {
    if (choice !== "custom" && choice !== "ladder" && choice !== "doubling") {
        return anteFormFromRule(presetAnteRule(choice), current);
    }
    if (previousChoice === "custom" && choice !== "custom") {
        return anteFormOfCustomText(customText, current)?.form ?? current;
    }
    return current;
}

/**
 * The controls as the custom text sets them, or undefined when the text does
 * not parse. `custom` is true for hand-written per-level antes no single rule
 * reproduces; the controls then show `fallback`'s level and size, and
 * changing them rewrites every level's ante.
 */
export function anteFormOfCustomText(text: string, fallback: AnteFormState): { form: AnteFormState; custom: boolean } | undefined {
    let structure: BlindStructureDTO;
    try {
        structure = parseBlindStructure(text);
    } catch {
        return undefined;
    }
    const rule = anteRuleOfStructure(structure);
    if (rule === "custom") return { form: { ...fallback, enabled: true }, custom: true };
    return { form: anteFormFromRule(rule, fallback), custom: false };
}

/**
 * The custom text with the controls' antes written in (the controls and the
 * text stay in sync, ui#891), or undefined when the text does not parse or the
 * controls are invalid. A preset name is written out as its structure.
 */
export function customTextWithAnte(text: string, ante: AnteFormState): string | undefined {
    if (validateAnteForm(ante)) return undefined;
    try {
        const structure = resolveBlindPreset(parseBlindStructure(text));
        return formatBlindStructure(applyAnteRule(structure, anteRuleFromForm(ante)), "custom");
    } catch {
        return undefined;
    }
}

/**
 * The custom text to open with when switching to Custom: the structure the
 * form had, antes included, written out, so custom starts from what the
 * preview showed. Undefined when there is nothing to write (keep the text).
 */
export function customTextFromPlan(plan: BlindPlan): string | undefined {
    const structure = plan.structure ?? plan.preview;
    if (!structure) return undefined;
    return formatBlindStructure(resolveBlindPreset(structure), "custom");
}

export interface BlindLevelRow {
    /** 1-based, for display. */
    number: number;
    smallBlind: string;
    bigBlind: string;
    ante: string;
    durationMinutes: number;
    isBreak: boolean;
}

/** The first `count` levels of a resolved structure, as the engine will play them. */
export function previewBlindLevels(preview: BlindStructureDTO, count: number): BlindLevelRow[] {
    const rows: BlindLevelRow[] = [];
    for (let n = 0; n < count; n++) {
        const l: BlindLevelDTO = expandBlindLevel(preview, n);
        rows.push({ number: n + 1, smallBlind: l.smallBlind, bigBlind: l.bigBlind, ante: l.ante, durationMinutes: l.durationMinutes, isBreak: l.isBreak });
    }
    return rows;
}

/** Whether any previewed level has an ante: the preview shows its Ante column only then, like the Blinds tab. */
export function previewHasAnte(rows: BlindLevelRow[]): boolean {
    return rows.some(r => !r.isBreak && r.ante !== "0" && r.ante !== "");
}

/** The opening level's blinds and duration — what the create message carries as small/big blind and level time. */
export function openingBlindsOf(preview: BlindStructureDTO): DoublingBlinds {
    const l = expandBlindLevel(preview, 0);
    return { smallBlind: Number(l.smallBlind), bigBlind: Number(l.bigBlind), durationMinutes: l.durationMinutes };
}

/** Whether the form's own opening blinds and level time drive the structure (ladder and doubling do; presets and custom carry their own). */
export function choiceUsesFormBlinds(choice: BlindStructureChoice): boolean {
    return choice === "ladder" || choice === "doubling";
}

/** One line describing how the blinds move, for the footnote under a preview table. */
export function describeBlindStructureChoice(choice: BlindStructureChoice): string {
    switch (choice) {
        case "ladder":
            return "Blinds climb a round-number ladder each level.";
        case "doubling":
            return "Blinds double each level, rounded to tidy numbers.";
        case "custom":
            return "Blinds follow your custom structure.";
        default:
            return `Blinds follow the ${PRESET_NAMES[choice]} preset (${presetLabel(choice)}).`;
    }
}

/**
 * The blind fields of a sit-and-go's create message for a resolved plan: the
 * opening level time, plus the structure when the choice submits one (ladder,
 * presets, custom). Doubling submits none (poker-vm#2738). Shared by the lobby
 * modal and /admin/tables so both send the same thing (ui#905).
 */
export function sngBlindFields(plan: BlindPlan, fallbackMinutes: number): { blindLevelDuration: number; blindStructure?: BlindStructureDTO } {
    const blindLevelDuration = plan.preview ? openingBlindsOf(plan.preview).durationMinutes : fallbackMinutes;
    return plan.structure ? { blindLevelDuration, blindStructure: plan.structure } : { blindLevelDuration };
}
