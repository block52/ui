import { ChiSquaredName, SuitKey } from "../pages/explorer/types";
import { Theme } from "./theme";

const RANK_ORDER: ReadonlyArray<string> = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

interface SuitGroup {
    key: SuitKey;
    name: string;
    color: Record<Theme, string>;
}

const SUITS: Record<SuitKey, SuitGroup> = {
    s: { key: "s", name: "Spades", color: { dark: "#d4d4dc", light: "#3f3f50" } },
    h: { key: "h", name: "Hearts", color: { dark: "#f87171", light: "#dc2626" } },
    d: { key: "d", name: "Diamonds", color: { dark: "#60a5fa", light: "#2563eb" } },
    c: { key: "c", name: "Clubs", color: { dark: "#15803d", light: "#15803d" } }
};

/** Chart order: spades, hearts, diamonds, clubs. */
export const SUIT_GROUPS: ReadonlyArray<SuitGroup> = [SUITS.s, SUITS.h, SUITS.d, SUITS.c];

const EXPECTED_LINE_COLOR: Record<Theme, string> = { dark: "#eab308", light: "#ca8a04" };

export const expectedLineColor = (theme: Theme): string => EXPECTED_LINE_COLOR[theme];

export const suitColor = (suit: SuitKey, theme: Theme): string => SUITS[suit].color[theme];

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

/** Card name for a tooltip, e.g. "A of spades". */
export const cardLabel = (card: CardLike): string => {
    const group = SUIT_GROUPS[suitIndex(card.suit)];
    return group ? `${card.rank.toUpperCase()} of ${group.name.toLowerCase()}` : `${card.rank}${card.suit}`;
};

export type TestBadge = "pass" | "marginal" | "fail" | "noData";

const BADGES: Record<ChiSquaredName, TestBadge> = { PASS: "pass", MARGINAL: "marginal", FAIL: "fail", NO_DATA: "noData" };

export const chiSquaredBadge = (result: ChiSquaredName): TestBadge => BADGES[result];

export type Verdict = "fair" | "borderline" | "bias" | "waiting";

/** Overall verdict from the card-level chi-squared test; no dealt cards or no result means nothing to judge yet. */
export const distributionVerdict = (cardTestResult: ChiSquaredName | null, cardsDealt: number): Verdict => {
    if (cardTestResult === null || cardsDealt === 0) return "waiting";
    switch (chiSquaredBadge(cardTestResult)) {
        case "noData":
            return "waiting";
        case "pass":
            return "fair";
        case "marginal":
            return "borderline";
        case "fail":
            return "bias";
    }
};

const CHANNELS = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;

/** A theme token's "R G B" channels (see styles/theme.css) as a canvas colour, or null when they are not three channels. */
export const channelsToRgb = (channels: string): string | null => {
    const match = CHANNELS.exec(channels.trim());
    return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : null;
};

export interface ChartChrome {
    grid: string;
    tick: string;
}

/** Chart.js draws on a canvas and cannot use CSS variables, so the `line` and `ink-muted` tokens are read from the page. */
export const readChartChrome = (): ChartChrome | null => {
    const style = getComputedStyle(document.documentElement);
    const grid = channelsToRgb(style.getPropertyValue("--line"));
    const tick = channelsToRgb(style.getPropertyValue("--ink-muted"));
    return grid !== null && tick !== null ? { grid, tick } : null;
};

/** Blocks the indexer may trail the chain head by and still count as synced (about one refresh). */
const INDEXER_SYNC_TOLERANCE_BLOCKS = 10;

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
