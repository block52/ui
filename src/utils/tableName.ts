/**
 * Paid table-name validation + cost helpers (ui#562 / poker-vm#337).
 *
 * The chain charges $0.10 per character and bills by Unicode code point. The
 * cost formula and length cap are owned by the SDK (computeGameNameFee /
 * GAME_NAME_MICRO_PER_CHAR / MAX_GAME_NAME_LENGTH) — this module only adds the
 * client-side charset/length validation that mirrors the chain and the
 * code-point count used for the live preview. Keep the counting basis identical
 * to the chain or the preview will mismatch the debit.
 */

import { MAX_GAME_NAME_LENGTH } from "@block52/poker-vm-sdk";

// Printable ASCII (space through ~). Rejects control chars and exotic Unicode to
// avoid billing/rendering ambiguity and homoglyph abuse (matches chain intent).
const ALLOWED_NAME = /^[\x20-\x7E]+$/;

/** Code-point length — the unit the chain bills on. */
export const tableNameCharCount = (name: string): number => [...name].length;

/**
 * Validate a (trimmed) table name. Returns an error message, or null if valid.
 * An empty string is valid here (means "no name") — callers decide whether a
 * name is required. Non-empty names must pass charset + length + no-surrounding
 * -whitespace rules.
 */
export function validateTableName(name: string): string | null {
    if (name.length === 0) {
        return null; // unnamed table — allowed, free
    }
    if (name !== name.trim()) {
        return "Table name cannot start or end with a space.";
    }
    if (!ALLOWED_NAME.test(name)) {
        return "Table name may only contain letters, numbers, spaces and common punctuation.";
    }
    if (tableNameCharCount(name) > MAX_GAME_NAME_LENGTH) {
        return `Table name must be ${MAX_GAME_NAME_LENGTH} characters or fewer.`;
    }
    return null;
}
