/**
 * Poker chip denominations and their associated chip images.
 *
 * Each entry maps a dollar value threshold to the chip image file.
 * Images are the marble set on the cards CDN (chips/marble/*.webp, rendered in Blender; see ui#776).
 * Sorted descending so the first match ≥ threshold wins.
 * The $1 chip also covers any amount less than $1.
 *
 * Visual colors (for reference — actual colours come from the images):
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
    { value: 5000000, file: "marble/5000000chip.webp", color: "platinum" },
    { value: 1000000, file: "marble/1000000chip.webp", color: "gold" },
    { value: 250000, file: "marble/250000chip.webp", color: "striped blue/orange" },
    { value: 100000, file: "marble/100000chip.webp", color: "pink" },
    { value: 25000,  file: "marble/25000chip.webp",  color: "blue" },
    { value: 5000,   file: "marble/5000chip.webp",   color: "orange" },
    { value: 1000,   file: "marble/1000chip.webp",   color: "yellow" },
    { value: 500,    file: "marble/500chip.webp",     color: "purple" },
    { value: 100,    file: "marble/100chip.webp",     color: "black" },
    { value: 25,     file: "marble/25chip.webp",      color: "green" },
    { value: 5,      file: "marble/5chip.webp",       color: "red" },
    { value: 1,      file: "marble/1chip.webp",       color: "white" },
    // Cent denominations (values in dollars)
    { value: 0.5,    file: "marble/50cent.webp",      color: "purple" },
    { value: 0.25,   file: "marble/25cent.webp",      color: "green" },
    { value: 0.1,    file: "marble/10cent.webp",      color: "yellow" },
    { value: 0.05,   file: "marble/5cent.webp",       color: "blue" },
    { value: 0.01,   file: "marble/1cent.webp",       color: "red" },
];

/** Fallback chip used for amounts < $1 */
export const DEFAULT_CHIP_FILE = "marble/1chip.webp";

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
