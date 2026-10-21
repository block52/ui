/**
 * Blind structure choice on the Create Sit & Go form (ui#860, poker-vm#1734).
 *
 * The form offers "Doubling" (today's behaviour: pick the opening blinds and
 * the minutes per level; the blinds double every level), the four engine
 * presets, or a custom structure written in the SDK's text form. This module
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

export type BlindStructureChoice = "doubling" | BlindPreset | "custom";

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
    { value: "doubling", label: "Doubling — choose the opening blinds and level time" },
    ...BLIND_PRESETS.map(preset => ({ value: preset, label: `${PRESET_NAMES[preset]} — ${presetLabel(preset)}` })),
    { value: "custom", label: "Custom — write a blind structure" }
];

export function isBlindStructureChoice(value: string): value is BlindStructureChoice {
    return BLIND_STRUCTURE_CHOICES.some(c => c.value === value);
}

/** What the custom textarea starts with: the turbo preset written out. */
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
 * preview. Doubling previews as a `double` structure built from the form's
 * blinds but submits nothing, so an existing table is created exactly as today.
 */
export function resolveBlindStructureChoice(choice: BlindStructureChoice, customText: string, doubling: DoublingBlinds): BlindPlan {
    if (choice === "doubling") {
        return {
            preview: {
                progression: "double",
                startSmallBlind: String(doubling.smallBlind),
                startBigBlind: String(doubling.bigBlind),
                durationMinutes: doubling.durationMinutes
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
