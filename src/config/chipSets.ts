/**
 * Chip sets (ui#842): the chip looks a player can pick in Settings and the
 * denominations every look provides. Data only — `constants/chips.ts` builds
 * the per-style, per-format lists the chip breakdown uses from this.
 *
 * Images live on the cards CDN at `chips/{dir}/{cash|tournament}/{file}.{ext}`
 * (block52/cards#5). Each style must provide:
 *   - `cash/`: every denomination below, with $ on dollars and ¢ on cents;
 *   - `tournament/`: the whole-number denominations as plain point values (no
 *     currency, no fractional chips).
 *
 * To add a look, add an entry to CHIP_STYLES and publish its two folders to
 * the cards repo; the Settings picker lists it automatically.
 */

export interface ChipStyleConfig {
    /** Stored in the player's settings; keep it stable once released. */
    id: string;
    /** Shown in the Settings picker. */
    label: string;
    /** Folder under `chips/` on the cards CDN. */
    dir: string;
    /** Image file type in that folder. */
    ext: "webp" | "svg" | "png";
}

export const CHIP_STYLES: readonly ChipStyleConfig[] = [
    // Photoreal marble, pearl value on a bigger black face.
    { id: "marble", label: "Marble", dir: "marble-pearl", ext: "webp" },
    // Flat vector chips with edge notches; sharpest at small sizes.
    { id: "notched", label: "Flat", dir: "notched", ext: "svg" }
];

/** The look a player gets until they choose one. */
export const DEFAULT_CHIP_STYLE_ID = "marble";

export interface ChipDenominationConfig {
    /** Dollars for cash games; chips (points) for SNG/tournaments. */
    value: number;
    /** Image base name, shared by every style and both sets. */
    file: string;
    /** Colour name, for reference and the debug view (colours come from the images). */
    color: string;
}

/**
 * Every denomination, largest first. Values below 1 are cent chips: cash only.
 * Colour code: $1 white, $5 red, $25 green, $100 black, $500 purple, $1K yellow,
 * $5K orange, $25K blue, $100K pink, $250K striped blue/orange, $1M gold,
 * $5M platinum.
 */
export const CHIP_DENOMINATION_CONFIG: readonly ChipDenominationConfig[] = [
    { value: 5000000, file: "5000000chip", color: "platinum" },
    { value: 1000000, file: "1000000chip", color: "gold" },
    { value: 250000, file: "250000chip", color: "striped blue/orange" },
    { value: 100000, file: "100000chip", color: "pink" },
    { value: 25000, file: "25000chip", color: "blue" },
    { value: 5000, file: "5000chip", color: "orange" },
    { value: 1000, file: "1000chip", color: "yellow" },
    { value: 500, file: "500chip", color: "purple" },
    { value: 100, file: "100chip", color: "black" },
    { value: 25, file: "25chip", color: "green" },
    { value: 5, file: "5chip", color: "red" },
    { value: 1, file: "1chip", color: "white" },
    { value: 0.5, file: "50cent", color: "purple" },
    { value: 0.25, file: "25cent", color: "green" },
    { value: 0.1, file: "10cent", color: "yellow" },
    { value: 0.05, file: "5cent", color: "blue" },
    { value: 0.01, file: "1cent", color: "red" }
];

/** A configured style by id; the default for an unknown or retired id. */
export function findChipStyle(id: string | null | undefined): ChipStyleConfig {
    return CHIP_STYLES.find(style => style.id === id) ?? CHIP_STYLES.find(style => style.id === DEFAULT_CHIP_STYLE_ID)!;
}
