import { CHIP_DENOMINATIONS, MAX_STACKS_PER_GROUP, MAX_CHIPS_PER_STACK } from "../constants/chips";

/**
 * chipBreakdown.ts — Poker Chip Denomination Decomposition
 *
 * Converts a dollar amount into physical poker chip representations using a
 * greedy algorithm. This is the core logic behind the chip visualization in
 * the Chip component.
 *
 * HOW IT WORKS:
 * =============
 *
 * 1. FLOOR TO WHOLE DOLLAR
 *    Sub-dollar amounts (e.g. $0.50 from micro-stakes) are floored to 0,
 *    which triggers a fallback to a single $1 (white) chip. Poker tables
 *    don't have fractional chips.
 *
 * 2. GREEDY DECOMPOSITION (largest-first)
 *    Walk through CHIP_DENOMINATIONS sorted descending ($5M → $1M → $250K →
 *    ... → $5 → $1). For each denomination, take as many as fit:
 *      count = floor(remainder / denomination)
 *    Then subtract: remainder -= count × denomination.
 *
 *    Because denominations are structured so each larger chip is a multiple
 *    of smaller ones, the greedy approach always yields exact change. The $1
 *    chip guarantees any whole-dollar amount decomposes exactly.
 *
 *    Example: $6,631
 *      $5,000 × 1 → remainder $1,631
 *      $1,000 × 1 → remainder $631
 *      $500   × 1 → remainder $131
 *      $100   × 1 → remainder $31
 *      $25    × 1 → remainder $6
 *      $5     × 1 → remainder $1
 *      $1     × 1 → remainder $0
 *      Result: 7 denomination stacks
 *
 * 3. DENOMINATION CAP (MAX_STACKS_PER_GROUP = 8)
 *    If the decomposition uses more than 8 different denominations, the
 *    lowest denominations are dropped to keep the visual compact. The lost
 *    value is redistributed as extra chips of the lowest KEPT denomination.
 *    Any sub-denomination remainder is unavoidably lost (visually only —
 *    the dollar label always shows the exact amount).
 *
 * 4. VISUAL STACKING CAP (MAX_CHIPS_PER_STACK = 6)
 *    Each denomination stack renders at most 6 chip images vertically.
 *    The true count is preserved in `count` for tooltip/debug purposes,
 *    but `visibleCount` is capped for a clean pile appearance.
 *
 * MULTI-ACTION MERGE BEHAVIOR (handled in Chip.tsx, not here):
 * =============================================================
 *    When a player makes multiple betting actions (blind, call, raise),
 *    each action can be decomposed separately for visual distinctness.
 *    However, when 3+ actions accumulate, Chip.tsx decomposes the TOTAL
 *    amount instead, so denominations consolidate upward (e.g., five $1
 *    actions become a single $5 red chip, not five separate white chips).
 *    The MERGE_THRESHOLD constant in Chip.tsx controls this.
 *
 * DENOMINATION TABLE:
 * ===================
 *    $1       → white               $500     → purple
 *    $5       → red                 $1,000   → yellow
 *    $25      → green               $5,000   → orange
 *    $100     → black               $25,000  → blue
 *    $100,000 → pink                $250,000 → striped blue/orange
 *    $1,000,000 → gold              $5,000,000 → platinum
 */

/**
 * A single denomination group in the breakdown.
 * Represents one vertical stack of same-colored chips.
 *
 * Example: For $312, one entry might be:
 *   { value: 100, file: "100chip.svg", color: "black", count: 3, visibleCount: 3 }
 *   This means "3 black ($100) chips stacked vertically"
 */
export interface ChipStackEntry {
    /** Dollar value of this denomination (e.g. 25) */
    value: number;
    /** SVG filename (e.g. "25chip.svg") — used as /cards/{file} */
    file: string;
    /** Visual color label for debugging and tests */
    color: string;
    /** True chip count this denomination represents (may exceed visual cap) */
    count: number;
    /** Number of chip images to render (capped to MAX_CHIPS_PER_STACK) */
    visibleCount: number;
}

/**
 * Decompose a dollar amount into the minimum set of physical poker chips.
 *
 * Uses a greedy algorithm walking denominations largest-first to produce
 * the fewest total chips. The result is an array of ChipStackEntry objects
 * ordered from highest to lowest denomination.
 *
 * Algorithm:
 *  1. Floor to nearest whole dollar (sub-dollar → fallback white chip)
 *  2. Greedy walk through CHIP_DENOMINATIONS (largest first)
 *  3. Cap to MAX_STACKS_PER_GROUP denomination columns
 *  4. Redistribute any dropped value into the lowest kept denomination
 *  5. Cap each column to MAX_CHIPS_PER_STACK visible images
 *
 * @param dollarAmount Dollar value (not USDC micro-units). Pass the result
 *                     of formatUSDCToSimpleDollars() or similar conversion.
 * @returns Array of ChipStackEntry, highest denomination first.
 *          Always returns at least one entry (minimum: 1 white chip).
 *
 * @example
 *   decomposeAmount(6)    → [{ $5, red, 1 }, { $1, white, 1 }]
 *   decomposeAmount(150)  → [{ $100, black, 1 }, { $25, green, 2 }]
 *   decomposeAmount(0.50) → [{ $1, white, 1 }]  // fallback
 */
export function decomposeAmount(dollarAmount: number): ChipStackEntry[] {
    // Work in cents for full accuracy
    const totalCents = Math.round(dollarAmount * 100);

    if (totalCents <= 0) {
        // Fallback: show 1¢ chip for zero or negative
        const fallback = CHIP_DENOMINATIONS.find(d => d.value === 0.01)!;
        return [{
            value: fallback.value,
            file: fallback.file,
            color: fallback.color,
            count: 1,
            visibleCount: 1,
        }];
    }

    let remainder = totalCents;
    const stacks: ChipStackEntry[] = [];

    // Greedy: take as many of each denomination as possible, largest first.
    for (const denom of CHIP_DENOMINATIONS) {
        const denomCents = Math.round(denom.value * 100);
        if (remainder < denomCents) continue;
        const count = Math.floor(remainder / denomCents);
        if (count > 0) {
            stacks.push({
                value: denom.value,
                file: denom.file,
                color: denom.color,
                count,
                visibleCount: Math.min(count, MAX_CHIPS_PER_STACK),
            });
            remainder -= count * denomCents;
        }
        if (remainder <= 0) break;
    }

    // If we used more denomination types than MAX_STACKS_PER_GROUP allows,
    // drop the lowest denominations and push their value into extra chips
    // of the lowest KEPT denomination. This keeps the chip cluster compact
    // while preserving as much visual accuracy as possible.
    //
    // Example with cap=8 and $5,831,631 (needs 10 denoms):
    //   Kept:    [5M, 250K, 25K, 5K, 1K, 500, 100, 25]
    //   Dropped: [5, 1] → total dropped = $6
    //   $6 / $25 = 0 extra chips (below $25), so $6 is lost visually.
    //   The dollar label still reads the exact amount.
    if (stacks.length > MAX_STACKS_PER_GROUP) {
        const dropped = stacks.slice(MAX_STACKS_PER_GROUP);
        const droppedValue = dropped.reduce((sum, s) => sum + s.value * s.count, 0);
        stacks.length = MAX_STACKS_PER_GROUP;

        if (droppedValue > 0) {
            const last = stacks[stacks.length - 1];
            const extraChips = Math.floor(droppedValue / last.value);
            if (extraChips > 0) {
                last.count += extraChips;
                last.visibleCount = Math.min(last.count, MAX_CHIPS_PER_STACK);
            }
        }
    }

    return stacks;
}

/**
 * Parse a comma-separated string of dollar amounts into an array of numbers.
 * Used by ChipDebugModal to convert user input into numeric amounts.
 *
 * @param text Comma-separated dollar values (e.g. "25, 130, 500")
 * @returns Array of non-negative numbers, empty values and NaN are filtered out.
 *
 * @example
 *   parseCustomAmounts("25, 130, 500")  → [25, 130, 500]
 *   parseCustomAmounts("abc, 10, -5")   → [10]
 *   parseCustomAmounts("")              → []
 */
export function parseCustomAmounts(text: string): number[] {
    return text
        .split(",")
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n) && n >= 0);
}

/**
 * Map chip color names to TailwindCSS classes for UI display.
 *
 * @param color The chip color name (e.g. "red", "black", "green")
 * @returns TailwindCSS background class string
 */
export function chipColorClass(color: string): string {
    switch (color) {
        case "white": return "bg-white";
        case "red": return "bg-red-500";
        case "green": return "bg-green-500";
        case "black": return "bg-gray-900";
        case "purple": return "bg-purple-500";
        case "yellow": return "bg-yellow-400";
        case "orange": return "bg-orange-500";
        case "blue": return "bg-blue-500";
        case "pink": return "bg-pink-400";
        case "striped blue/orange": return "bg-gradient-to-r from-blue-500 to-orange-500";
        default: return "bg-gray-500";
    }
}
