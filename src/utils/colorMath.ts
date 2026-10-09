/**
 * Pure hex-colour helpers used to derive theme tokens from the configurable
 * brand colour (VITE_BRAND_COLOR_PRIMARY). Kept free of `import.meta.env`
 * so they run under Jest.
 */

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const parseHex = (hex: string): [number, number, number] => {
    if (!HEX_PATTERN.test(hex)) {
        throw new Error(`colorMath: "${hex}" is not a 6-digit hex colour`);
    }
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};

const toHex = (channel: number): string => Math.round(channel).toString(16).padStart(2, "0");

/**
 * Space-separated RGB channels for Tailwind's `rgb(var(--x) / <alpha-value>)`.
 * @example hexToRgbChannels("#7c3aed") // "124 58 237"
 */
export const hexToRgbChannels = (hex: string): string => parseHex(hex).join(" ");

/**
 * Blend `hex` toward `target` by `amount` (0 keeps `hex`, 1 returns `target`).
 * @example mixHex("#000000", "#ffffff", 0.5) // "#808080"
 */
export const mixHex = (hex: string, target: string, amount: number): string => {
    if (amount < 0 || amount > 1) {
        throw new Error(`colorMath: mix amount ${amount} is outside 0..1`);
    }
    const from = parseHex(hex);
    const to = parseHex(target);
    return `#${from.map((c, i) => toHex(c + (to[i] - c) * amount)).join("")}`;
};
