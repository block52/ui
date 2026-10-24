/**
 * Poker chip denominations and their images.
 *
 * The chip looks and denominations are configured in config/chipSets.ts
 * (ui#842); this module turns them into the per-style cash and tournament lists
 * the chip breakdown walks, sorted descending so the first match ≥ threshold
 * wins. Cash sets carry $ on dollars and ¢ on cents; tournament sets are points
 * with no currency and no fractional chips.
 */

import { CHIP_DENOMINATION_CONFIG, CHIP_STYLES, DEFAULT_CHIP_STYLE_ID, findChipStyle, type ChipStyleConfig } from "../config/chipSets";

export interface ChipDenomination {
    value: number;
    file: string;
    color: string;
}

const buildChipSet = (style: ChipStyleConfig, isTournament: boolean): ChipDenomination[] => {
    const set = isTournament ? "tournament" : "cash";
    return CHIP_DENOMINATION_CONFIG.filter(d => !isTournament || d.value >= 1).map(d => ({
        value: d.value,
        file: `${style.dir}/${set}/${d.file}.${style.ext}`,
        color: d.color
    }));
};

// Built once per configured style, so each lookup returns a stable array.
const CHIP_SETS = new Map(
    CHIP_STYLES.map(style => [style.id, { cash: buildChipSet(style, false), tournament: buildChipSet(style, true) }])
);

/**
 * The chips to draw for a style (an id from config/chipSets; unknown ids get the
 * default) and format: cash ($/¢) or tournament (points, same colours as the
 * dollar chips, no fractional chips; 1/5/25/100… make exact change for any
 * whole-number bet). Largest first.
 */
export const getChipSet = (styleId: string, isTournament: boolean): ChipDenomination[] => {
    const sets = CHIP_SETS.get(findChipStyle(styleId).id)!;
    return isTournament ? sets.tournament : sets.cash;
};

/** Cash chips in the default style. */
export const CHIP_DENOMINATIONS: ChipDenomination[] = getChipSet(DEFAULT_CHIP_STYLE_ID, false);

/** Tournament chips in the default style. */
export const TOURNAMENT_CHIP_DENOMINATIONS: ChipDenomination[] = getChipSet(DEFAULT_CHIP_STYLE_ID, true);

/** Fallback chip used for amounts < $1 */
export const DEFAULT_CHIP_FILE = CHIP_DENOMINATIONS.find(d => d.value === 1)!.file;

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
