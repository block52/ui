import { expandBlindLevel, resolveBlindPreset, type BlindLevelDTO, type BlindStructureDTO } from "@block52/poker-vm-sdk";
import type { TournamentStateDTO } from "../types/tournament";
import { hasContent, isNumber, isRecord, isString } from "./guards";

/**
 * Blind schedule of a directed (multi-table tournament) table.
 *
 * A directed table's gameOptions carry the CURRENT level only (smallBlind,
 * bigBlind, blindLevel, levelStartTime); the director owns the schedule, so
 * the next level and the level length come from the tournament's
 * options.blindStructure. The engine derives every level from (structure,
 * level) (pvm/go/engine/tournament_blinds.go); the SDK's expandBlindLevel is
 * the same function, so nothing is mirrored here beyond break handling.
 */

export interface DirectedBlinds {
    /** The concrete structure (a preset resolved). */
    structure: Exclude<BlindStructureDTO, { preset: unknown }>;
    /** The level in force (0-based), as expanded from the structure. */
    current: BlindLevelDTO;
    /** The first playing (non-break) level after `current`. */
    next: BlindLevelDTO;
    /** True when the current level is a break or a break sits before `next`. */
    breakAhead: boolean;
    /** Length of the current level in seconds. */
    levelDurationSeconds: number;
}

// A table schedule repeats its last row, which is never a break, so the walk
// ends within the schedule; the bound only guards a malformed structure.
const MAX_BREAK_RUN = 1000;

/** Blinds for `level` of a tournament's structure: current, next playing level, level length. */
export const directedBlinds = (blindStructure: BlindStructureDTO, level: number): DirectedBlinds => {
    if (!Number.isInteger(level) || level < 0) throw new Error(`tournament level ${level} must be a non-negative integer`);
    const structure = resolveBlindPreset(blindStructure);
    const current = expandBlindLevel(structure, level);
    let breakAhead = current.isBreak;
    for (let n = level + 1; n <= level + MAX_BREAK_RUN; n++) {
        const candidate = expandBlindLevel(structure, n);
        if (!candidate.isBreak) {
            return { structure, current, next: candidate, breakAhead, levelDurationSeconds: current.durationMinutes * 60 };
        }
        breakAhead = true;
    }
    throw new Error("tournament blind structure has no playing level after a run of breaks");
};

/** Parse the `tournament` JSON string of the chain query, checking what the UI relies on. */
export const parseTournamentState = (json: string): TournamentStateDTO => {
    const raw: unknown = JSON.parse(json);
    if (!isRecord(raw)) throw new Error("tournament state is not an object");
    if (!isString(raw.tournamentId)) throw new Error("tournament state: tournamentId required");
    if (!isString(raw.status)) throw new Error("tournament state: status required");
    if (!isNumber(raw.level)) throw new Error("tournament state: level required");
    if (!isRecord(raw.options) || !isRecord(raw.options.blindStructure)) throw new Error("tournament state: options.blindStructure required");
    if (!Array.isArray(raw.entrants)) throw new Error("tournament state: entrants required");
    if (!Array.isArray(raw.tables)) throw new Error("tournament state: tables required");
    return raw as unknown as TournamentStateDTO;
};

/** The tournament a table belongs to (root `tournamentId` of the table state), if it is a directed table. */
export const tournamentIdOf = (gameState: unknown): string | undefined => {
    if (!isRecord(gameState)) return undefined;
    const id = gameState.tournamentId;
    return isString(id) && hasContent(id) ? id : undefined;
};
