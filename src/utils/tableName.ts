/**
 * Paid table-name normalization + validation + cost helpers (ui#562 / poker-vm#337).
 *
 * These MUST mirror the chain exactly (pokerchain `x/poker/types/game_name.go`,
 * `NormalizeAndValidateGameName` / `GameNameFee`) or the UI preview will accept
 * names the chain rejects, or quote a fee that doesn't match the debit:
 *
 *   - ENS-style label rule: lowercase ASCII alphanumerics + single interior
 *     hyphens, 1–32 code points, no leading/trailing hyphen, no double hyphen.
 *   - Names are case-insensitive: the chain trims + lowercases, so "Friday" and
 *     "friday" collide and cost the same. We normalize identically and validate
 *     / fee the CANONICAL (normalized) form, never the raw input.
 *   - $0.10 per code point; empty name = unnamed, free.
 *
 * The cost formula + length cap come from the SDK (computeGameNameFee /
 * GAME_NAME_MICRO_PER_CHAR / MAX_GAME_NAME_LENGTH); this module adds the
 * charset/normalization the SDK doesn't own.
 */

import { MAX_GAME_NAME_LENGTH } from "@block52/poker-vm-sdk";

// ENS-style label rule — identical to the chain's gameNameRe.
const GAME_NAME_RE = /^[a-z0-9](-?[a-z0-9]){0,31}$/;

/**
 * Canonical form the chain stores: trimmed + lowercased. An empty/whitespace-only
 * raw name normalizes to "" (unnamed). Use this for the fee preview and for the
 * value submitted to createGame so both match the chain.
 */
export const normalizeTableName = (raw: string): string => raw.trim().toLowerCase();

/** Code-point length — the unit the chain bills on. */
export const tableNameCharCount = (name: string): number => [...name].length;

/**
 * Validate a raw table name (normalized internally). Returns an error message,
 * or null if valid. An empty/whitespace-only name is valid (means "no name",
 * free) — callers decide whether a name is required. Mirrors the chain's
 * validation order (length before charset).
 */
export function validateTableName(raw: string): string | null {
    const name = normalizeTableName(raw);
    if (name.length === 0) {
        return null; // unnamed table — allowed, free
    }
    if (tableNameCharCount(name) > MAX_GAME_NAME_LENGTH) {
        return `Table name must be ${MAX_GAME_NAME_LENGTH} characters or fewer.`;
    }
    if (!GAME_NAME_RE.test(name)) {
        return "Table name must be lowercase letters, numbers and single hyphens (a–z, 0–9, -), with no leading, trailing or double hyphen.";
    }
    return null;
}
