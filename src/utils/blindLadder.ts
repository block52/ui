/**
 * The default sit-and-go blind ladder (ui#905): round big blinds that repeat
 * the same steps every power of ten — 1, 1.5, 2, 3, 4, 6, 8 — modelled on a
 * live deep-stack tournament sheet and scaled for 1,500-chip stacks:
 *
 *   BB 20, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1,000, 1,500, …
 *
 * Each level is ×1.33 to ×1.5 (doubling every two levels or so) instead of the
 * ×2 of plain doubling. The small blind is always half the big blind.
 *
 * The engine has no ladder progression, so the ladder is submitted as a
 * `table` structure (live since pokerchain v0.1.190); past its last row the
 * engine repeats that row.
 */

import type { BlindLevelDTO, TableBlindStructureDTO } from "@block52/poker-vm-sdk";

/** The ladder below 100, before the per-decade steps take over. */
const LADDER_OPENING: ReadonlyArray<number> = [20, 40, 60, 80];

/** Big blinds within one decade, in tenths of its base: 1, 1.5, 2, 3, 4, 6, 8. */
const LADDER_DECADE_STEPS: ReadonlyArray<number> = [10, 15, 20, 30, 40, 60, 80];

/** How many levels a ladder structure carries; the last one repeats after that. */
export const LADDER_LEVEL_COUNT = 30;

/** The ladder's big blinds above `after`, ascending, `count` of them. */
export function ladderBigBlindsAbove(after: number, count: number): number[] {
    const out: number[] = [];
    for (const bb of LADDER_OPENING) {
        if (out.length === count) return out;
        if (bb > after) out.push(bb);
    }
    for (let base = 100; out.length < count; base *= 10) {
        for (const step of LADDER_DECADE_STEPS) {
            if (out.length === count) return out;
            const bb = (step * base) / 10;
            if (bb > after) out.push(bb);
        }
    }
    return out;
}

/**
 * The ladder as a table structure: level 1 is the opening blinds, then the
 * ladder's next big blinds above them, every level `durationMinutes` long,
 * with no ante.
 */
export function ladderStructure(smallBlind: number, bigBlind: number, durationMinutes: number, levelCount: number = LADDER_LEVEL_COUNT): TableBlindStructureDTO {
    const row = (level: number, sb: number, bb: number): BlindLevelDTO => ({
        level,
        smallBlind: String(sb),
        bigBlind: String(bb),
        ante: "0",
        durationMinutes,
        isBreak: false
    });
    const levels = [row(0, smallBlind, bigBlind)];
    ladderBigBlindsAbove(bigBlind, levelCount - 1).forEach((bb, i) => levels.push(row(i + 1, bb / 2, bb)));
    return { progression: "table", levels };
}
