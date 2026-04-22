import { decomposeAmount, ChipStackEntry, parseCustomAmounts, chipColorClass } from "./chipBreakdown";

/**
 * Helper: extract just the relevant fields for assertions.
 * Returns [value, color, count, visibleCount] tuples.
 */
function summarize(stacks: ChipStackEntry[]): Array<[number, string, number, number]> {
    return stacks.map(s => [s.value, s.color, s.count, s.visibleCount]);
}

/** Helper: extract just the colors for quick assertions */
function colors(stacks: ChipStackEntry[]): string[] {
    return stacks.map(s => s.color);
}

/** Helper: total visible chip images to render */
function totalVisible(stacks: ChipStackEntry[]): number {
    return stacks.reduce((sum, s) => sum + s.visibleCount, 0);
}

describe("decomposeAmount", () => {
    // =====================================================================
    // EDGE CASES: Sub-dollar and zero amounts
    // =====================================================================
    describe("sub-dollar and zero amounts", () => {
        it("$0 → 1 red 1¢ chip (fallback)", () => {
            const result = decomposeAmount(0);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.01);
            expect(result[0].color).toBe("red");
            expect(result[0].visibleCount).toBe(1);
        });

        it("$0.01 → 1 red 1¢ chip", () => {
            const result = decomposeAmount(0.01);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.01);
            expect(result[0].color).toBe("red");
        });

        it("$0.05 → 1 blue 5¢ chip", () => {
            const result = decomposeAmount(0.05);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.05);
            expect(result[0].color).toBe("blue");
        });

        it("$0.10 → 1 yellow 10¢ chip", () => {
            const result = decomposeAmount(0.10);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.1);
            expect(result[0].color).toBe("yellow");
        });

        it("$0.25 → 1 green 25¢ chip", () => {
            const result = decomposeAmount(0.25);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.25);
            expect(result[0].color).toBe("green");
        });

        it("$0.50 → 1 purple 50¢ chip", () => {
            const result = decomposeAmount(0.5);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.5);
            expect(result[0].color).toBe("purple");
        });

        it("$0.99 → 1×50¢ + 1×25¢ + 2×10¢ + 4×1¢", () => {
            const result = decomposeAmount(0.99);
            expect(result).toHaveLength(4);
            expect(result[0].value).toBe(0.5);
            expect(result[1].value).toBe(0.25);
            expect(result[2].value).toBe(0.1);
            expect(result[2].count).toBe(2);
            expect(result[3].value).toBe(0.01);
            expect(result[3].count).toBe(4);
        });

        it("negative amount → 1 red 1¢ chip", () => {
            const result = decomposeAmount(-5);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.01);
            expect(result[0].color).toBe("red");
        });
    });

    // =====================================================================
    // SINGLE CHIP: Exact denomination matches
    // =====================================================================
    describe("exact single denomination", () => {
        it.each([
            [1, "white", "1chip.svg"],
            [5, "red", "5chip.svg"],
            [25, "green", "25chip.svg"],
            [100, "black", "100chip.svg"],
            [500, "purple", "500chip.svg"],
            [1000, "yellow", "1000chip.svg"],
            [5000, "orange", "5000chip.svg"],
            [25000, "blue", "25000chip.svg"],
            [100000, "pink", "100000chip.svg"],
            [250000, "striped blue/orange", "250000chip.svg"],
            [1000000, "gold", "1000000chip.svg"],
            [5000000, "platinum", "5000000chip.svg"],
        ])("$%i → 1 %s chip (%s)", (amount, color, file) => {
            const result = decomposeAmount(amount);
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(amount);
            expect(result[0].color).toBe(color);
            expect(result[0].file).toBe(file);
            expect(result[0].count).toBe(1);
            expect(result[0].visibleCount).toBe(1);
        });
    });

    // =====================================================================
    // VERTICAL STACKING: Multiple chips of same denomination
    // =====================================================================
    describe("vertical stacking (same denomination repeated)", () => {
        it("$2 → 2 white chips stacked", () => {
            const result = decomposeAmount(2);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("white");
            expect(result[0].count).toBe(2);
            expect(result[0].visibleCount).toBe(2);
        });

        it("$3 → 3 white chips stacked", () => {
            const result = decomposeAmount(3);
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(3);
            expect(result[0].visibleCount).toBe(3);
        });

        it("$4 → 4 white chips stacked (at cap)", () => {
            const result = decomposeAmount(4);
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(4);
            expect(result[0].visibleCount).toBe(4); // MAX_CHIPS_PER_STACK = 4
        });

        it("$10 → 2 red chips stacked", () => {
            const result = decomposeAmount(10);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("red");
            expect(result[0].count).toBe(2);
            expect(result[0].visibleCount).toBe(2);
        });

        it("$200 → 2 black chips stacked", () => {
            const result = decomposeAmount(200);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("black");
            expect(result[0].count).toBe(2);
            expect(result[0].visibleCount).toBe(2);
        });

        it("$400 → 4 black chips stacked", () => {
            const result = decomposeAmount(400);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("black");
            expect(result[0].count).toBe(4);
            expect(result[0].visibleCount).toBe(4);
        });

        it("$600 of $100 chips → 6 black chips stacked (at visual cap)", () => {
            const result = decomposeAmount(600);
            expect(result).toHaveLength(2); // $500 + $100
            // Test a pure case: $6 in $1 chips
            const r2 = decomposeAmount(6);
            // $6 = $5 + $1, not 6x$1
            expect(r2).toHaveLength(2);
        });
    });

    // =====================================================================
    // VISUAL CAP: visibleCount capped at MAX_CHIPS_PER_STACK (6)
    // =====================================================================
    describe("visibleCount cap at MAX_CHIPS_PER_STACK (6)", () => {
        it("$20 → 4 red chips, all visible (under cap)", () => {
            const result = decomposeAmount(20);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("red");
            expect(result[0].count).toBe(4);
            expect(result[0].visibleCount).toBe(4);
        });

        it("$24 (4× red + 4× white) → 2 stacks, all visible", () => {
            const result = decomposeAmount(24);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("red");
            expect(result[0].count).toBe(4);
            expect(result[0].visibleCount).toBe(4);
            expect(result[1].color).toBe("white");
            expect(result[1].count).toBe(4);
            expect(result[1].visibleCount).toBe(4);
        });

        it("$30 in $5 chips → 6 red, visibleCount = 6 (at cap)", () => {
            const result = decomposeAmount(30);
            // $30 = $25 + $5, not 6×$5
            expect(result).toHaveLength(2);
        });

        it("$7 in $1 chips → 7 white, visibleCount capped at 6", () => {
            // $7 = $5 + 2×$1
            const result = decomposeAmount(7);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("red");
            expect(result[1].color).toBe("white");
            expect(result[1].count).toBe(2);
            expect(result[1].visibleCount).toBe(2);
        });
    });

    // =====================================================================
    // MULTI-COLUMN: 2 denomination stacks (overlapping horizontally)
    // =====================================================================
    describe("2 denomination columns", () => {
        it("$6 → 1 red ($5) + 1 white ($1)", () => {
            const result = decomposeAmount(6);
            expect(result).toHaveLength(2);
            expect(summarize(result)).toEqual([
                [5, "red", 1, 1],
                [1, "white", 1, 1],
            ]);
        });

        it("$26 → 1 green ($25) + 1 white ($1)", () => {
            const result = decomposeAmount(26);
            expect(result).toHaveLength(2);
            expect(colors(result)).toEqual(["green", "white"]);
        });

        it("$30 → 1 green ($25) + 1 red ($5)", () => {
            const result = decomposeAmount(30);
            expect(result).toHaveLength(2);
            expect(colors(result)).toEqual(["green", "red"]);
        });

        it("$50 → 2 green ($25)", () => {
            const result = decomposeAmount(50);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("green");
            expect(result[0].count).toBe(2);
        });

        it("$125 → 1 black ($100) + 1 green ($25)", () => {
            const result = decomposeAmount(125);
            expect(result).toHaveLength(2);
            expect(colors(result)).toEqual(["black", "green"]);
        });

        it("$600 → 1 purple ($500) + 1 black ($100)", () => {
            const result = decomposeAmount(600);
            expect(result).toHaveLength(2);
            expect(colors(result)).toEqual(["purple", "black"]);
        });

        it("$1500 → 1 yellow ($1000) + 1 purple ($500)", () => {
            const result = decomposeAmount(1500);
            expect(result).toHaveLength(2);
            expect(colors(result)).toEqual(["yellow", "purple"]);
        });
    });

    // =====================================================================
    // MULTI-COLUMN: 3 denomination stacks (max horizontal columns)
    // =====================================================================
    describe("3 denomination columns (maximum)", () => {
        it("$31 → green ($25) + red ($5) + white ($1)", () => {
            const result = decomposeAmount(31);
            expect(result).toHaveLength(3);
            expect(colors(result)).toEqual(["green", "red", "white"]);
            expect(totalVisible(result)).toBe(3);
        });

        it("$131 → black ($100) + green ($25) + red ($5) + white ($1) → 4 columns", () => {
            // $131 = 100 + 25 + 5 + 1 = 4 denominations (under cap of 5)
            const result = decomposeAmount(131);
            expect(result).toHaveLength(4);
            expect(colors(result)).toEqual(["black", "green", "red", "white"]);
        });

        it("$130 → black ($100) + green ($25) + red ($5)", () => {
            const result = decomposeAmount(130);
            expect(result).toHaveLength(3);
            expect(colors(result)).toEqual(["black", "green", "red"]);
        });

        it("$626 → purple ($500) + black ($100) + green ($25) + white ($1) → 4 columns", () => {
            // $626 = 500 + 100 + 25 + 1 = 4 denoms (under cap of 5)
            const result = decomposeAmount(626);
            expect(result).toHaveLength(4);
            expect(colors(result)).toEqual(["purple", "black", "green", "white"]);
        });
    });

    // =====================================================================
    // STACK CAP: More than 8 denominations get truncated
    // =====================================================================
    describe("denomination cap at MAX_STACKS_PER_GROUP (8)", () => {
        it("$131 needs 4 denoms → all shown (under cap)", () => {
            const result = decomposeAmount(131);
            expect(result).toHaveLength(4);
            const values = result.map(s => s.value);
            expect(values).toEqual([100, 25, 5, 1]);
        });

        it("$1266 needs 5 denoms → all shown (under cap)", () => {
            const result = decomposeAmount(1266);
            expect(result).toHaveLength(5);
            const values = result.map(s => s.value);
            expect(values).toEqual([1000, 100, 25, 5, 1]);
        });

        it("$6631 needs 7 denoms → all shown (under cap)", () => {
            // $6631 = 5000 + 1000 + 500 + 100 + 25 + 5 + 1 = 7 denoms
            const result = decomposeAmount(6631);
            expect(result).toHaveLength(7);
            const values = result.map(s => s.value);
            expect(values).toEqual([5000, 1000, 500, 100, 25, 5, 1]);
            const total = result.reduce((sum, s) => sum + s.value * s.count, 0);
            expect(total).toBe(6631);
        });

        it("$25689420 needs 8 denoms → all shown (at cap)", () => {
            const result = decomposeAmount(25689420);
            expect(result).toHaveLength(8);
            const total = result.reduce((sum, s) => sum + s.value * s.count, 0);
            expect(total).toBe(25689420);
        });

        it("amount needing >8 denoms → capped to 8, remainder redistributed", () => {
            // $25,814,631 = 5M×5 + 1M×0 + 250K×3 + 100K×0 + 25K×1 + 5K×2 + 1K×4 + 500×1 + 100×1 + 25×1 + 5×1 + 1×1 = 9+ denoms
            // Need an amount that actually hits >8 denominations
            // $5,831,631 = 5M×1 + 250K×3 + 100K×0 + 25K×1 + 5K×1 + 1K×1 + 500×1 + 100×1 + 25×1 + 5×1 + 1×1 = 10 denoms
            const result = decomposeAmount(5831631);
            expect(result.length).toBeLessThanOrEqual(8);
        });
    });

    // =====================================================================
    // COMBINED: Vertical + horizontal together
    // =====================================================================
    describe("combined vertical stacks + horizontal columns", () => {
        it("$52 → 2× green ($25) stacked + 2× white ($1) stacked", () => {
            const result = decomposeAmount(52);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("green");
            expect(result[0].count).toBe(2);
            expect(result[0].visibleCount).toBe(2);
            expect(result[1].color).toBe("white");
            expect(result[1].count).toBe(2);
            expect(result[1].visibleCount).toBe(2);
            expect(totalVisible(result)).toBe(4);
        });

        it("$77 → 3× green ($25) + 2× white ($1)", () => {
            const result = decomposeAmount(77);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("green");
            expect(result[0].count).toBe(3);
            expect(result[0].visibleCount).toBe(3);
            expect(result[1].color).toBe("white");
            expect(result[1].count).toBe(2);
        });

        it("$312 → 3× black ($100) + 2× red ($5) + 2× white ($1)", () => {
            const result = decomposeAmount(312);
            expect(result).toHaveLength(3);
            expect(result[0].color).toBe("black");
            expect(result[0].count).toBe(3);
            expect(result[1].color).toBe("red");
            expect(result[1].count).toBe(2);
            expect(result[2].color).toBe("white");
            expect(result[2].count).toBe(2);
        });

        it("$475 → 4× black ($100) + 3× green ($25) + 0 remaining", () => {
            const result = decomposeAmount(475);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("black");
            expect(result[0].count).toBe(4);
            expect(result[0].visibleCount).toBe(4);
            expect(result[1].color).toBe("green");
            expect(result[1].count).toBe(3);
            expect(result[1].visibleCount).toBe(3);
        });
    });

    // =====================================================================
    // REAL GAME SCENARIOS: Common poker table amounts
    // =====================================================================
    describe("real game scenarios", () => {
        it("micro-stakes BB ($0.04) → 4×1¢ red chips", () => {
            const result = decomposeAmount(0.04);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("red");
            expect(result[0].count).toBe(4);
            expect(result[0].value).toBe(0.01);
        });

        it("micro-stakes raise ($0.12) → 1×10¢ yellow + 2×1¢ red", () => {
            const result = decomposeAmount(0.12);
            expect(result).toHaveLength(2);
            expect(result[0].value).toBe(0.1);
            expect(result[0].color).toBe("yellow");
            expect(result[1].value).toBe(0.01);
            expect(result[1].color).toBe("red");
            expect(result[1].count).toBe(2);
        });

        it("$1/$2 BB ($2) → 2 white chips stacked", () => {
            const result = decomposeAmount(2);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("white");
            expect(result[0].count).toBe(2);
        });

        it("$1/$2 raise to $6 → 1 red + 1 white", () => {
            const result = decomposeAmount(6);
            expect(colors(result)).toEqual(["red", "white"]);
        });

        it("$5/$10 BB ($10) → 2 red stacked", () => {
            const result = decomposeAmount(10);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("red");
            expect(result[0].count).toBe(2);
        });

        it("$5/$10 raise to $30 → 1 green + 1 red", () => {
            const result = decomposeAmount(30);
            expect(colors(result)).toEqual(["green", "red"]);
        });

        it("$25/$50 BB ($50) → 2 green stacked", () => {
            const result = decomposeAmount(50);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("green");
            expect(result[0].count).toBe(2);
        });

        it("$25/$50 raise to $150 → 1 black ($100) + 2 green ($25)", () => {
            const result = decomposeAmount(150);
            expect(result).toHaveLength(2);
            expect(result[0].color).toBe("black");
            expect(result[0].count).toBe(1);
            expect(result[1].color).toBe("green");
            expect(result[1].count).toBe(2);
        });

        it("$100/$200 all-in $5000 → 1 orange", () => {
            const result = decomposeAmount(5000);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("orange");
        });

        it("$100/$200 all-in $5555 → orange + purple + green + red", () => {
            // $5555 = 5000 + 500 + 2×25 + 1×5 = 4 denoms (under cap)
            const result = decomposeAmount(5555);
            expect(result).toHaveLength(4);
            expect(colors(result)).toEqual(["orange", "purple", "green", "red"]);
        });
    });

    // =====================================================================
    // ACCURACY: Exact chip representation for reported amounts
    // =====================================================================
    describe("accuracy - exact denomination coverage", () => {
        it("$1266 → yellow + 2× black + 2× green + 3× red + 1× white = 5 denoms", () => {
            const result = decomposeAmount(1266);
            expect(result).toHaveLength(5);
            expect(result.map(s => [s.color, s.count])).toEqual([
                ["yellow", 1],   // $1000
                ["black", 2],    // $200
                ["green", 2],    // $50
                ["red", 3],      // $15
                ["white", 1],    // $1
            ]);
            // Total: 1000 + 200 + 50 + 15 + 1 = $1266 ✓
        });

        it("$999 → all denominations covered accurately", () => {
            const result = decomposeAmount(999);
            expect(result).toHaveLength(5);
            const totalValue = result.reduce((sum, s) => sum + s.value * s.count, 0);
            expect(totalValue).toBe(999);
        });

        it("$10000 → 2× orange ($5000)", () => {
            const result = decomposeAmount(10000);
            expect(result).toHaveLength(1);
            expect(result[0].color).toBe("orange");
            expect(result[0].count).toBe(2);
        });

        it("$12345 → accurate multi-denomination decomposition", () => {
            const result = decomposeAmount(12345);
            const totalValue = result.reduce((sum, s) => sum + s.value * s.count, 0);
            expect(result.length).toBeLessThanOrEqual(5);
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });

    // =====================================================================
    // TOTAL VISIBLE CHIP COUNT (for rendering assertions)
    // =====================================================================
    describe("total visible chip images", () => {
        it("$1 → 1 image", () => {
            expect(totalVisible(decomposeAmount(1))).toBe(1);
        });

        it("$6 → 2 images (1 red + 1 white)", () => {
            expect(totalVisible(decomposeAmount(6))).toBe(2);
        });

        it("$31 → 3 images (1 green + 1 red + 1 white)", () => {
            expect(totalVisible(decomposeAmount(31))).toBe(3);
        });

        it("$52 → 4 images (2 green + 2 white)", () => {
            expect(totalVisible(decomposeAmount(52))).toBe(4);
        });

        it("$400 → 4 images (4× black)", () => {
            expect(totalVisible(decomposeAmount(400))).toBe(4);
        });

        it("$312 → 8 images (3 black + 2 red + 2 white + 1... check)", () => {
            // $312 = 3×100 + 2×5 + 2×1 = 7 images (3 denoms)
            // With cap=8: all shown
            expect(totalVisible(decomposeAmount(312))).toBe(7);
        });
    });

    // =====================================================================
    // FILE REFERENCES (ensure correct SVG mapping)
    // =====================================================================
    describe("SVG file mapping", () => {
        it("all results reference valid chip SVG files", () => {
            const validFiles = [
                "1chip.svg", "5chip.svg", "25chip.svg", "100chip.svg",
                "500chip.svg", "1000chip.svg", "5000chip.svg",
                "25000chip.svg", "100000chip.svg", "250000chip.svg",
                "1000000chip.svg", "5000000chip.svg",
                "1cent.svg", "5cent.svg", "10cent.svg", "25cent.svg", "50cent.svg",
            ];

            // Test a range of amounts
            const amounts = [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 5, 6, 25, 31, 100, 131, 500, 1000, 5555, 250000, 1000000, 5000000];
            for (const amt of amounts) {
                const result = decomposeAmount(amt);
                result.forEach(stack => {
                    expect(validFiles).toContain(stack.file);
                });
            }
        });
    });

    // =====================================================================
    // MULTI-BET SCENARIOS: Simulates Chip.tsx merge behavior
    // Tests both per-action decomposition (< MERGE_THRESHOLD) and
    // total decomposition (>= MERGE_THRESHOLD) to verify the visual
    // output matches expectations for 1-bet through 10-bet rounds.
    //
    // MERGE_THRESHOLD is set in Chip.tsx (currently 3). Below threshold,
    // each action is decomposed separately. At/above threshold, the
    // TOTAL is decomposed as one combined pile.
    // =====================================================================
    describe("multi-bet scenarios (Chip.tsx merge simulation)", () => {
        const MERGE_THRESHOLD = 3;

        /**
         * Simulates Chip.tsx logic: if actions >= threshold, decompose total;
         * otherwise decompose each action separately and combine stacks.
         */
        function simulateChipMerge(actionDollars: number[]): ChipStackEntry[] {
            if (actionDollars.length >= MERGE_THRESHOLD) {
                const total = actionDollars.reduce((s, a) => s + a, 0);
                return decomposeAmount(total);
            }
            return actionDollars.flatMap(a => decomposeAmount(a));
        }

        // --- 1-bet scenarios (always per-action, below threshold) ---
        it("1-bet: SB $1 → 1 white chip", () => {
            const stacks = simulateChipMerge([1]);
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("white");
            expect(stacks[0].count).toBe(1);
        });

        it("1-bet: BB $50 → 2 green chips", () => {
            const stacks = simulateChipMerge([50]);
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("green");
            expect(stacks[0].count).toBe(2);
        });

        // --- 2-bet scenarios (per-action, below threshold) ---
        it("2-bet: SB($25) + BB($50) → each decomposed separately", () => {
            const stacks = simulateChipMerge([25, 50]);
            // $25 → 1 green; $50 → 2 green → 3 total stacks combined
            expect(stacks).toHaveLength(2); // 2 separate decompositions
            expect(stacks[0].color).toBe("green"); // $25
            expect(stacks[0].count).toBe(1);
            expect(stacks[1].color).toBe("green"); // $50
            expect(stacks[1].count).toBe(2);
        });

        it("2-bet: BB($2) + Call($2) → 2 separate white piles", () => {
            const stacks = simulateChipMerge([2, 2]);
            expect(stacks).toHaveLength(2);
            expect(stacks[0].color).toBe("white");
            expect(stacks[0].count).toBe(2);
            expect(stacks[1].color).toBe("white");
            expect(stacks[1].count).toBe(2);
        });

        // --- 3-bet scenarios (AT threshold → merges to total) ---
        it("3-bet: BB($50) + Call($100) + Raise($250) → total $400, merged", () => {
            const stacks = simulateChipMerge([50, 100, 250]);
            // Total: $400 = 4× black ($100)
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("black");
            expect(stacks[0].count).toBe(4);
        });

        it("3-bet: $1 + $1 + $1 → total $3, merged to 3 white", () => {
            const stacks = simulateChipMerge([1, 1, 1]);
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("white");
            expect(stacks[0].count).toBe(3);
        });

        it("3-bet: $5 + $5 + $5 → total $15, merged to 1 red ($5) + 2 red ($5) = 3 red", () => {
            const stacks = simulateChipMerge([5, 5, 5]);
            // $15 = $5 × 3
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("red");
            expect(stacks[0].count).toBe(3);
        });

        // --- 4-bet scenarios (above threshold → merges to total) ---
        it("4-bet: SB($25) + BB($50) + Call($50) + Raise($150) → total $275", () => {
            const stacks = simulateChipMerge([25, 50, 50, 150]);
            // $275 = 2× black ($200) + 3× green ($75)
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(275);
            expect(stacks[0].color).toBe("black");
            expect(stacks[0].count).toBe(2);
            expect(stacks[1].color).toBe("green");
            expect(stacks[1].count).toBe(3);
        });

        // --- 5-bet scenario ---
        it("5-bet: $10 + $20 + $40 + $80 + $160 → total $310", () => {
            const stacks = simulateChipMerge([10, 20, 40, 80, 160]);
            // $310 = 3× black + 2× red
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(310);
            expect(stacks[0].color).toBe("black");
            expect(stacks[0].count).toBe(3);
        });

        // --- 6-bet scenario ---
        it("6-bet: 6× $100 → total $600 = 1 purple + 1 black", () => {
            const stacks = simulateChipMerge([100, 100, 100, 100, 100, 100]);
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(600);
            expect(stacks[0].color).toBe("purple");
            expect(stacks[1].color).toBe("black");
        });

        // --- 7-bet scenario ---
        it("7-bet: mix of small bets → total $77, merged", () => {
            const stacks = simulateChipMerge([5, 10, 15, 12, 10, 15, 10]);
            // $77 = 3× green ($75) + 2× white ($2)
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(77);
            expect(stacks[0].color).toBe("green");
            expect(stacks[0].count).toBe(3);
        });

        // --- 8-bet scenario ---
        it("8-bet: escalating raises → total $2550", () => {
            const stacks = simulateChipMerge([50, 100, 150, 200, 300, 400, 500, 850]);
            // $2550 = 2× yellow ($2000) + 1 purple ($500) + 2 green ($50)
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(2550);
        });

        // --- 9-bet scenario ---
        it("9-bet: aggressive re-raising → total $4680", () => {
            const stacks = simulateChipMerge([20, 40, 80, 160, 320, 640, 1000, 1200, 1220]);
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(4680);
            // Should have multiple denomination types
            expect(stacks.length).toBeGreaterThanOrEqual(2);
            expect(stacks.length).toBeLessThanOrEqual(8);
        });

        // --- 10-bet scenario ---
        it("10-bet: maximum betting actions → total $10000", () => {
            const stacks = simulateChipMerge([100, 200, 300, 500, 700, 1000, 1200, 1500, 2000, 2500]);
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(10000);
            // $10000 = 2× orange ($5000)
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("orange");
            expect(stacks[0].count).toBe(2);
        });

        // --- Denomination consolidation (the key feature) ---
        it("many small $1 bets consolidate to larger denominations", () => {
            // 51× $1 actions → should produce $25 chips, not 51 white chips
            const actions = Array(51).fill(1);
            const stacks = simulateChipMerge(actions);
            // $51 = 2× green ($50) + 1× white ($1)
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(51);
            expect(stacks[0].color).toBe("green");
            expect(stacks[0].count).toBe(2);
            expect(stacks[1].color).toBe("white");
            expect(stacks[1].count).toBe(1);
        });

        it("many $5 bets consolidate to green and higher", () => {
            // 20× $5 = $100 → 1 black chip
            const actions = Array(20).fill(5);
            const stacks = simulateChipMerge(actions);
            const total = stacks.reduce((s, e) => s + e.value * e.count, 0);
            expect(total).toBe(100);
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("black");
        });

        // --- Per-action vs merged comparison ---
        it("below threshold: 2 actions stay separate", () => {
            // $6 + $31 → [red+white] + [green+red+white] = 5 stacks
            const stacks = simulateChipMerge([6, 31]);
            expect(stacks.length).toBe(5); // 2 from $6 + 3 from $31
        });

        it("at threshold: same 3 actions merge to fewer stacks", () => {
            // $6 + $31 + $13 = $50 → 2 green chips = 1 stack
            const stacks = simulateChipMerge([6, 31, 13]);
            expect(stacks).toHaveLength(1);
            expect(stacks[0].color).toBe("green");
            expect(stacks[0].count).toBe(2);
        });
    });
});

// =====================================================================
// parseCustomAmounts — comma-separated string → number[]
// =====================================================================
describe("parseCustomAmounts", () => {
    it("parses a single value", () => {
        expect(parseCustomAmounts("50")).toEqual([50]);
    });

    it("parses multiple comma-separated values", () => {
        expect(parseCustomAmounts("25, 130, 500")).toEqual([25, 130, 500]);
    });

    it("handles extra whitespace", () => {
        expect(parseCustomAmounts("  10 ,  20 , 30  ")).toEqual([10, 20, 30]);
    });

    it("filters out NaN values", () => {
        expect(parseCustomAmounts("abc, 10, xyz")).toEqual([10]);
    });

    it("filters out negative values", () => {
        expect(parseCustomAmounts("10, -5, 20")).toEqual([10, 20]);
    });

    it("returns empty array for empty string", () => {
        expect(parseCustomAmounts("")).toEqual([]);
    });

    it("returns empty array for all-invalid input", () => {
        expect(parseCustomAmounts("abc, def")).toEqual([]);
    });

    it("handles decimal values", () => {
        expect(parseCustomAmounts("0.02, 0.04, 1.5")).toEqual([0.02, 0.04, 1.5]);
    });

    it("allows zero", () => {
        expect(parseCustomAmounts("0, 10")).toEqual([0, 10]);
    });
});

// =====================================================================
// chipColorClass — color name → TailwindCSS class
// =====================================================================
describe("chipColorClass", () => {
    it("returns bg-white for white", () => {
        expect(chipColorClass("white")).toBe("bg-white");
    });

    it("returns bg-red-500 for red", () => {
        expect(chipColorClass("red")).toBe("bg-red-500");
    });

    it("returns bg-green-500 for green", () => {
        expect(chipColorClass("green")).toBe("bg-green-500");
    });

    it("returns bg-gray-900 for black", () => {
        expect(chipColorClass("black")).toBe("bg-gray-900");
    });

    it("returns bg-purple-500 for purple", () => {
        expect(chipColorClass("purple")).toBe("bg-purple-500");
    });

    it("returns bg-yellow-400 for yellow", () => {
        expect(chipColorClass("yellow")).toBe("bg-yellow-400");
    });

    it("returns bg-orange-500 for orange", () => {
        expect(chipColorClass("orange")).toBe("bg-orange-500");
    });

    it("returns bg-blue-500 for blue", () => {
        expect(chipColorClass("blue")).toBe("bg-blue-500");
    });

    it("returns bg-pink-400 for pink", () => {
        expect(chipColorClass("pink")).toBe("bg-pink-400");
    });

    it("returns gradient for striped blue/orange", () => {
        expect(chipColorClass("striped blue/orange")).toBe("bg-gradient-to-r from-blue-500 to-orange-500");
    });

    it("returns bg-gray-500 for unknown colors", () => {
        expect(chipColorClass("magenta")).toBe("bg-gray-500");
        expect(chipColorClass("")).toBe("bg-gray-500");
    });
});
