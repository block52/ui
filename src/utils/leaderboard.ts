/**
 * Live chip-leaderboard standings for tournaments / sit-and-gos (ui#280).
 *
 * Pure, front-end-only derivation from the live `gameState.players` array —
 * no indexer, no new endpoint. It ranks the players still in the event by
 * their current chip stack and reports each one's share of the chips in play,
 * so the UI can show who is chip leader *right now*. This is deliberately
 * NOT winnings / buy-in P&L (that needs buy-in events — indexer #721) and NOT
 * final placements (those come from `gameState.results`; see
 * useSitAndGoPlayerResults).
 *
 * Tournament/SNG stacks are chip-unit strings, so `stack` is read with a plain
 * `Number()` and NEVER run through `convertUSDCToNumber` (see CLAUDE.md
 * "Stack Value Handling"). Callers must only pass tournament/SNG state;
 * chip-share is meaningless for cash games.
 */

import { PlayerDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import { hasElements } from "./guards";

/** One row of the live chip leaderboard. */
export interface ChipStanding {
    /** Rank by stack, 1 = chip leader. Ties share a rank; busted players share the trailing rank. */
    rank: number;
    address: string;
    seat: number;
    /** The player's avatar payload, passed through for name/avatar resolution. */
    avatar?: string;
    /** Chip count as a number (chip units, not USDC). */
    stack: number;
    /** Share of all chips still in play, 0–100. `0` for busted players. */
    pctOfChips: number;
    /** True when the player has been eliminated (busted or zero stack). */
    isBusted: boolean;
}

/** Aggregate figures for the leaderboard footer. */
export interface ChipStandingsSummary {
    standings: ChipStanding[];
    /** Chips still in play across all non-busted players. */
    totalChips: number;
    /** Players not yet eliminated. */
    playersRemaining: number;
    /** `totalChips / playersRemaining`, or `0` when nobody remains. */
    averageStack: number;
}

/**
 * True when a player is out of the event — explicit BUSTED status or a stack
 * that has drained to zero (or non-numeric). Either way they are excluded from
 * the chip-share denominator and sorted to the bottom.
 */
function isEliminated(stack: number, status: PlayerStatus): boolean {
    return status === PlayerStatus.BUSTED || !Number.isFinite(stack) || stack <= 0;
}

/**
 * Rank players by live chip stack and compute each one's share of chips in play.
 *
 * - Sorted by stack descending; ties break by seat ascending for a stable order.
 * - Busted / zero-stack players sort last and get `pctOfChips: 0`.
 * - Rank is standard competition ranking: tied stacks share a rank and the
 *   next distinct stack skips accordingly (two leaders → 1,1,3). Eliminated
 *   players all share the single rank after the last live player.
 * - `pctOfChips` denominator is the sum of live stacks only, so live shares
 *   sum to ~100.
 */
export function computeChipStandings(players: PlayerDTO[] | null | undefined): ChipStandingsSummary {
    if (!hasElements(players)) {
        return { standings: [], totalChips: 0, playersRemaining: 0, averageStack: 0 };
    }

    const rows = players.map(player => {
        const stack = Number(player.stack);
        const busted = isEliminated(stack, player.status);
        return {
            address: player.address,
            seat: player.seat,
            avatar: player.avatar,
            stack: Number.isFinite(stack) && stack > 0 ? stack : 0,
            isBusted: busted
        };
    });

    const totalChips = rows.reduce((sum, r) => (r.isBusted ? sum : sum + r.stack), 0);
    const playersRemaining = rows.filter(r => !r.isBusted).length;
    const averageStack = playersRemaining > 0 ? totalChips / playersRemaining : 0;

    // Live players first (stack desc), then busted; seat asc breaks every tie so
    // the order is deterministic across WS frames.
    rows.sort((a, b) => {
        if (a.isBusted !== b.isBusted) return a.isBusted ? 1 : -1;
        if (a.stack !== b.stack) return b.stack - a.stack;
        return a.seat - b.seat;
    });

    let rank = 0;
    let prevStack: number | null = null;
    const standings: ChipStanding[] = rows.map((r, index) => {
        if (r.isBusted) {
            // Every eliminated player shares one rank, just after the live field.
            rank = playersRemaining + 1;
        } else if (prevStack === null || r.stack !== prevStack) {
            // New distinct stack among live players → competition rank = position
            // in the sorted field (index 0 → 1). Ties keep the previous rank, so
            // the next distinct stack skips (two leaders give 1,1,3).
            rank = index + 1;
            prevStack = r.stack;
        }
        return {
            rank,
            address: r.address,
            seat: r.seat,
            avatar: r.avatar,
            stack: r.stack,
            pctOfChips: !r.isBusted && totalChips > 0 ? (r.stack / totalChips) * 100 : 0,
            isBusted: r.isBusted
        };
    });

    return { standings, totalChips, playersRemaining, averageStack };
}
