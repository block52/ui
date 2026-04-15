/**
 * Poker chip denominations and their associated SVG assets.
 *
 * Each entry maps a dollar value threshold to the chip image file.
 * Sorted descending so the first match ≥ threshold wins.
 * The $1 chip also covers any amount less than $1.
 *
 * Visual colors (for reference — actual colours come from the SVGs):
 *   $1      = white
 *   $5      = red
 *   $25     = green
 *   $100    = black
 *   $500    = purple
 *   $1000   = yellow
 *   $5000   = orange
 *   $25000  = blue
 *   $100000 = pink
 *   $250000 = striped blue/orange
 *   $1000000 = gold
 *   $5000000 = platinum
 */

export interface ChipDenomination {
    value: number;
    file: string;
    color: string;
}

export const CHIP_DENOMINATIONS: ChipDenomination[] = [
    { value: 5000000, file: "5000000chip.svg", color: "platinum" },
    { value: 1000000, file: "1000000chip.svg", color: "gold" },
    { value: 250000, file: "250000chip.svg", color: "striped blue/orange" },
    { value: 100000, file: "100000chip.svg", color: "pink" },
    { value: 25000,  file: "25000chip.svg",  color: "blue" },
    { value: 5000,   file: "5000chip.svg",   color: "orange" },
    { value: 1000,   file: "1000chip.svg",   color: "yellow" },
    { value: 500,    file: "500chip.svg",     color: "purple" },
    { value: 100,    file: "100chip.svg",     color: "black" },
    { value: 25,     file: "25chip.svg",      color: "green" },
    { value: 5,      file: "5chip.svg",       color: "red" },
    { value: 1,      file: "1chip.svg",       color: "white" },
];

/** Fallback chip used for amounts < $1 */
export const DEFAULT_CHIP_FILE = "1chip.svg";

/** Maximum number of action groups (side-by-side chip placements) to display */
export const MAX_ACTION_GROUPS = 5;

/** Maximum number of denomination columns within a single action group */
export const MAX_STACKS_PER_GROUP = 8;

/** Maximum number of overlapping chips within a single stack */
export const MAX_CHIPS_PER_STACK = 6;

/** Horizontal gap between action groups (px) — wider than within-group spacing */
export const ACTION_GROUP_GAP = 12;

/** Horizontal gap between denomination stacks within one group (px) */
export const STACK_GAP = 29;
