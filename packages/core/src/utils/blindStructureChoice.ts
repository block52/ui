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
 */
export function resolveBlindStructureChoice(choice: BlindStructureChoice, customText: string, doubling: DoublingBlinds): BlindPlan {
    if (choice === "ladder") {
        const structure = ladderStructure(doubling.smallBlind, doubling.bigBlind, doubling.durationMinutes);
        return { structure, preview: structure };
    }
    if (choice === "doubling") {
        return {
            preview: {
                progression: "double",
                startSmallBlind: String(doubling.smallBlind),
                startBigBlind: String(doubling.bigBlind),
                durationMinutes: doubling.durationMinutes,
                roundBlinds: true
            }
        };
    }
    if (choice === "custom") {
        try {
            const structure = parseBlindStructure(customText);
            return { structure, preview: resolveBlindPreset(structure) };
        } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }
    const structure: BlindStructureDTO = { preset: choice };
    return { structure, preview: resolveBlindPreset(structure) };
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
