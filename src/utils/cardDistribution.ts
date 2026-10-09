/**
 * Pure helpers for the Hand Distribution page: ordering the 52 cards into suit
 * groups for the chart and turning the indexer's chi-squared results into labels.
 */

export const RANK_ORDER: ReadonlyArray<string> = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export type SuitKey = "s" | "h" | "d" | "c";

export interface SuitGroup {
    key: SuitKey;
    name: string;
    color: string;
}

/** Chart order and colours: spades, hearts, diamonds, clubs. */
export const SUIT_GROUPS: ReadonlyArray<SuitGroup> = [
    { key: "s", name: "Spades", color: "#d4d4dc" },
    { key: "h", name: "Hearts", color: "#f87171" },
    { key: "d", name: "Diamonds", color: "#60a5fa" },
    { key: "c", name: "Clubs", color: "#15803d" }
];

export const EXPECTED_LINE_COLOR = "#eab308";

interface CardLike {
    rank: string;
    suit: string;
}

const suitIndex = (suit: string): number => SUIT_GROUPS.findIndex(g => g.key === suit.toLowerCase());
const rankIndex = (rank: string): number => RANK_ORDER.indexOf(rank.toUpperCase());

/** Sort cards by suit group (S, H, D, C) then rank (2..A). Unknown values sort last. */
export const sortCardsBySuit = <T extends CardLike>(cards: ReadonlyArray<T>): T[] => {
    const order = (i: number) => (i === -1 ? Number.MAX_SAFE_INTEGER : i);
    return [...cards].sort((a, b) => order(suitIndex(a.suit)) - order(suitIndex(b.suit)) || order(rankIndex(a.rank)) - order(rankIndex(b.rank)));
};

/** Bar colour for a card's suit; throws on a suit the indexer should never send. */
export const suitColor = (suit: string): string => {
    const group = SUIT_GROUPS[suitIndex(suit)];
    if (!group) throw new Error(`cardDistribution: unknown suit "${suit}"`);
    return group.color;
};

/** Human-readable card name for a tooltip, e.g. "A of spades". */
export const cardLabel = (card: CardLike): string => {
    const group = SUIT_GROUPS[suitIndex(card.suit)];
    return group ? `${card.rank.toUpperCase()} of ${group.name.toLowerCase()}` : `${card.rank}${card.suit}`;
};

export type TestBadge = "pass" | "marginal" | "fail" | "noData";

/** Maps the indexer's chi-squared `result` ("PASS" | "MARGINAL" | "FAIL" | "NO_DATA") to a badge. */
export const chiSquaredBadge = (result: string): TestBadge => {
    switch (result) {
        case "PASS":
            return "pass";
        case "MARGINAL":
            return "marginal";
        case "FAIL":
            return "fail";
        case "NO_DATA":
            return "noData";
        default:
            throw new Error(`cardDistribution: unknown chi-squared result "${result}"`);
    }
};

export type Verdict = "fair" | "bias" | "waiting";

/**
 * Overall verdict from the card-level chi-squared test. No dealt cards (or no
 * test result) means there is nothing to judge yet.
 */
export const distributionVerdict = (cardTestResult: string | null, cardsDealt: number): Verdict => {
    if (cardTestResult === null || cardsDealt === 0) return "waiting";
    const badge = chiSquaredBadge(cardTestResult);
    if (badge === "noData") return "waiting";
    return badge === "pass" ? "fair" : "bias";
};

/** Chart chrome, matching the `line` and `ink-muted` design tokens (chart.js needs literal colours). */
export const CHART_GRID_COLOR = "#262938";
export const CHART_TICK_COLOR = "#8e90a6";

/** Blocks the indexer may trail the chain head by and still count as synced (about one refresh). */
export const INDEXER_SYNC_TOLERANCE_BLOCKS = 10;

/**
 * Whether the indexer has caught up with the chain head. Uses heights
 * (`last_block_indexed` vs `total_blocks`), not `blocks_indexed`: the live
 * indexer reports a handful of blocks there while its last height is at the head.
 */
export const isIndexerSynced = (status: { total_blocks: number; last_block_indexed: number }): boolean =>
    status.total_blocks - status.last_block_indexed <= INDEXER_SYNC_TOLERANCE_BLOCKS;

/** Chi-squared numbers for display, e.g. "χ² 44.1 · df 51 · p 0.740". */
export const formatChiSquared = (test: { chi_squared: number; degrees_of_freedom: number; p_value: number }): string =>
    `χ² ${test.chi_squared.toFixed(1)} · df ${test.degrees_of_freedom} · p ${test.p_value.toFixed(3)}`;
