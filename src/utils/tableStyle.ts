/**
 * Table appearance options (the bottom-left "TABLE: …" toggle and the
 * mobile header Style row). New appearances register here and in their
 * own CSS under [data-table-theme].
 */

import { isString } from "./guards";

export const TABLE_STYLE_OPTIONS = ["modern", "classic", "nouns", "blockchainpoker"] as const;

export type TableStyleOption = (typeof TABLE_STYLE_OPTIONS)[number];

export const TABLE_STYLE_LABELS: Record<TableStyleOption, string> = {
    modern: "Modern",
    classic: "Classic",
    nouns: "Nouns",
    blockchainpoker: "Blockchain Poker"
};

/** Official felt watermark for the Blockchain Poker appearance. */
export const BLOCKCHAIN_POKER_FELT_LOGO = "/appearances/blockchain-poker/official-felt-logo-2000.png";

/** Charcoal card back with the full-colour official chevron. */
export const BLOCKCHAIN_POKER_CARD_BACK = "/appearances/blockchain-poker/card-back-charcoal.svg";

export function isTableStyleOption(value: unknown): value is TableStyleOption {
    return isString(value) && (TABLE_STYLE_OPTIONS as readonly string[]).includes(value);
}

/** Initial appearance from VITE_TABLE_STYLE; unknown or unset values fall back to modern. */
export function resolveDefaultTableStyle(envValue: unknown): TableStyleOption {
    return isTableStyleOption(envValue) ? envValue : "modern";
}

export function nextTableStyle(current: TableStyleOption): TableStyleOption {
    const index = TABLE_STYLE_OPTIONS.indexOf(current);
    return TABLE_STYLE_OPTIONS[(index + 1) % TABLE_STYLE_OPTIONS.length];
}

/** Felt watermark for the active appearance. Other appearances keep the club logo. */
export function feltLogoForTheme(theme: TableStyleOption, clubLogo: string): string {
    return theme === "blockchainpoker" ? BLOCKCHAIN_POKER_FELT_LOGO : clubLogo;
}

/**
 * Card-back style token for the active appearance. Blockchain Poker uses its
 * own back; every other appearance keeps the existing env / default behaviour.
 */
export function cardBackStyleForTheme(theme: TableStyleOption, envCardBack: string): string {
    return theme === "blockchainpoker" ? "blockchainpoker" : envCardBack;
}
