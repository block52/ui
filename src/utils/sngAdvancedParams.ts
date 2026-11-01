/**
 * Advanced Sit & Go parameter parsing, validation and preview.
 *
 * The Create Sit & Go form exposes an "advanced options" modal where a user
 * can paste a raw JSON object of custom params. This module holds the pure,
 * unit-tested logic for that flow: parse the JSON, validate it against the SNG
 * create-table shape, and compute a human-readable preview (starting stacks,
 * runners, blind levels) before anything is written back into the form.
 *
 * All values here are in the SAME units the form uses:
 * - buyIn: dollars (USDC)
 * - startingStack / smallBlind / bigBlind: chips (tournament chip units)
 * - blindLevelDuration: minutes
 * - maxPlayers: number of runners/entrants
 */

import { hasValue, isNullish, isBlank } from "./guards";
import type { AnteFormState } from "./anteRule";
import { describeBlindStructureChoice, previewBlindLevels, resolveBlindStructureChoice, type BlindStructureChoice } from "./blindStructureChoice";

/** Chain-defined valid entrant counts for a Sit & Go. */
export const VALID_SNG_RUNNER_COUNTS = [2, 4, 6, 9] as const;

/** Number of blind levels shown in the preview structure. */
export const SNG_PREVIEW_LEVEL_COUNT = 10;

/**
 * Custom advanced params a user may supply as JSON. Every field is optional —
 * anything omitted falls back to the current form value when applied.
 */
export interface AdvancedSngParams {
    maxPlayers?: number;        // Runners / entrants (must be one of VALID_SNG_RUNNER_COUNTS)
    buyIn?: number;             // Buy-in in dollars
    startingStack?: number;     // Starting chips per player
    smallBlind?: number;        // Starting small blind (chips)
    bigBlind?: number;          // Starting big blind (chips)
    blindLevelDuration?: number; // Minutes per blind level
}

/**
 * All recognised param keys — the single source of truth for both validation
 * (rejecting unknown fields) and the UI's "recognised fields" hint.
 */
export const ADVANCED_SNG_FIELDS: (keyof AdvancedSngParams)[] = [
    "maxPlayers",
    "buyIn",
    "startingStack",
    "smallBlind",
    "bigBlind",
    "blindLevelDuration"
];

/**
 * Discriminated union so `params` is guaranteed present (never nullish) on the
 * success branch — callers narrow on `isValid` and get typed params with no
 * further guard needed.
 */
export type AdvancedSngParseResult =
    | { isValid: true; params: AdvancedSngParams; errors: [] }
    | { isValid: false; errors: string[] };

export interface BlindLevelPreview {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    durationMinutes: number;
    isBreak: boolean;
}

export interface SngPreview {
    runners: number;
    startingStack: number;
    buyIn: number;
    blindLevelDuration: number;
    /** Total chips in play across all runners. */
    totalChipsInPlay: number;
    levels: BlindLevelPreview[];
    /** How the blinds move, for the note under the preview table. */
    structureNote: string;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/**
 * Parse and validate a raw JSON string of advanced SNG params.
 *
 * Validation rules (all errors are collected, not fail-fast):
 * - Must be valid JSON describing a plain object.
 * - Unknown keys are rejected (typo protection).
 * - Every present value must be a finite, positive number.
 * - maxPlayers must be one of the chain-defined runner counts.
 * - smallBlind must be less than bigBlind when both are present.
 * - blindLevelDuration must be a positive integer number of minutes.
 */
export function parseAdvancedSngParams(raw: string): AdvancedSngParseResult {
    const trimmed = raw.trim();
    if (isBlank(trimmed)) {
        return { isValid: false, errors: ["Enter a JSON object of custom params."] };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { isValid: false, errors: [`Invalid JSON: ${message}`] };
    }

    if (isNullish(parsed) || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { isValid: false, errors: ["Params must be a JSON object, e.g. { \"startingStack\": 1500 }."] };
    }

    const obj = parsed as Record<string, unknown>;
    const errors: string[] = [];

    // Reject unknown keys so typos surface instead of being silently ignored.
    for (const key of Object.keys(obj)) {
        if (!ADVANCED_SNG_FIELDS.includes(key as keyof AdvancedSngParams)) {
            errors.push(`Unknown field "${key}". Allowed: ${ADVANCED_SNG_FIELDS.join(", ")}.`);
        }
    }

    // Numeric + positive checks for every present field.
    for (const key of ADVANCED_SNG_FIELDS) {
        if (isNullish(obj[key])) continue;
        if (!isFiniteNumber(obj[key])) {
            errors.push(`"${key}" must be a number.`);
        } else if ((obj[key] as number) <= 0) {
            errors.push(`"${key}" must be greater than 0.`);
        }
    }

    const params: AdvancedSngParams = {};
    if (isFiniteNumber(obj.maxPlayers)) params.maxPlayers = obj.maxPlayers;
    if (isFiniteNumber(obj.buyIn)) params.buyIn = obj.buyIn;
    if (isFiniteNumber(obj.startingStack)) params.startingStack = obj.startingStack;
    if (isFiniteNumber(obj.smallBlind)) params.smallBlind = obj.smallBlind;
    if (isFiniteNumber(obj.bigBlind)) params.bigBlind = obj.bigBlind;
    if (isFiniteNumber(obj.blindLevelDuration)) params.blindLevelDuration = obj.blindLevelDuration;

    // Cross-field / domain rules — only when the underlying value was numeric.
    if (hasValue(params.maxPlayers) && !VALID_SNG_RUNNER_COUNTS.includes(params.maxPlayers as 2 | 4 | 6 | 9)) {
        errors.push(`"maxPlayers" must be one of ${VALID_SNG_RUNNER_COUNTS.join(", ")}.`);
    }

    if (hasValue(params.smallBlind) && hasValue(params.bigBlind) && params.smallBlind >= params.bigBlind) {
        errors.push("\"smallBlind\" must be less than \"bigBlind\".");
    }

    if (hasValue(params.startingStack) && !Number.isInteger(params.startingStack)) {
        errors.push("\"startingStack\" must be a whole number of chips.");
    }

    if (hasValue(params.blindLevelDuration) && !Number.isInteger(params.blindLevelDuration)) {
        errors.push("\"blindLevelDuration\" must be a whole number of minutes.");
    }

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    return { isValid: true, params, errors: [] };
}

export interface SngPreviewInput {
    maxPlayers: number;
    buyIn: number;
    startingStack: number;
    smallBlind: number;
    bigBlind: number;
    blindLevelDuration: number;
    /** The create form's blind structure (ui#905); omitted = doubling, what the chain plays when none is sent. */
    blindStructureChoice?: BlindStructureChoice;
    /** The custom structure text, read when blindStructureChoice is "custom". */
    customBlindText?: string;
    /** The form's ante controls (ui#891); omitted = each structure's own antes. */
    anteForm?: AnteFormState;
}

/**
 * Build a preview of the resulting Sit & Go from effective values (form
 * values merged with any applied advanced params). The levels are the ones the
 * engine will play for the form's blind structure (ladder, rounded doubling,
 * a preset or custom), expanded by the SDK exactly as the create form's preview.
 */
export function buildSngPreview(input: SngPreviewInput): SngPreview {
    const choice = input.blindStructureChoice ?? "doubling";
    const plan = resolveBlindStructureChoice(choice, input.customBlindText ?? "", {
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        durationMinutes: input.blindLevelDuration
    }, input.anteForm);
    const levels: BlindLevelPreview[] = plan.preview
        ? previewBlindLevels(plan.preview, SNG_PREVIEW_LEVEL_COUNT).map(r => ({
              level: r.number,
              smallBlind: Number(r.smallBlind),
              bigBlind: Number(r.bigBlind),
              ante: Number(r.ante),
              durationMinutes: r.durationMinutes,
              isBreak: r.isBreak
          }))
        : [];

    return {
        runners: input.maxPlayers,
        startingStack: input.startingStack,
        buyIn: input.buyIn,
        blindLevelDuration: input.blindLevelDuration,
        totalChipsInPlay: input.startingStack * input.maxPlayers,
        levels,
        structureNote: describeBlindStructureChoice(choice)
    };
}

/**
 * Merge applied advanced params over the current effective form values.
 * Any param left undefined keeps the existing form value.
 */
export function mergeAdvancedParams(current: SngPreviewInput, params: AdvancedSngParams): SngPreviewInput {
    return {
        ...current,
        maxPlayers: hasValue(params.maxPlayers) ? params.maxPlayers : current.maxPlayers,
        buyIn: hasValue(params.buyIn) ? params.buyIn : current.buyIn,
        startingStack: hasValue(params.startingStack) ? params.startingStack : current.startingStack,
        smallBlind: hasValue(params.smallBlind) ? params.smallBlind : current.smallBlind,
        bigBlind: hasValue(params.bigBlind) ? params.bigBlind : current.bigBlind,
        blindLevelDuration: hasValue(params.blindLevelDuration) ? params.blindLevelDuration : current.blindLevelDuration
    };
}
