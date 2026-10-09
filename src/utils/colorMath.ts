/**
 * Pure hex-colour helpers used to derive theme tokens from the configurable
 * brand colour (VITE_BRAND_COLOR_PRIMARY).
 */

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Parse "#rgb" or "#rrggbb" into 0-255 channels; throws on anything else. */
export const parseHex = (hex: string): [number, number, number] => {
    if (!HEX_PATTERN.test(hex)) {
        throw new Error(`colorMath: "${hex}" is not a 3- or 6-digit hex colour`);
    }
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    return [parseInt(full.slice(1, 3), 16), parseInt(full.slice(3, 5), 16), parseInt(full.slice(5, 7), 16)];
};

const toHex = (channel: number): string => Math.round(channel).toString(16).padStart(2, "0");

/** Space-separated channels for Tailwind's `rgb(var(--x) / <alpha-value>)`: "#7c3aed" gives "124 58 237". */
export const hexToRgbChannels = (hex: string): string => parseHex(hex).join(" ");

/** Blend `hex` toward `target` by `amount` (0 keeps `hex`, 1 returns `target`). */
export const mixHex = (hex: string, target: string, amount: number): string => {
    if (amount < 0 || amount > 1) {
        throw new Error(`colorMath: mix amount ${amount} is outside 0..1`);
    }
    const from = parseHex(hex);
    const to = parseHex(target);
    return `#${from.map((c, i) => toHex(c + (to[i] - c) * amount)).join("")}`;
};

/** "rgba(r, g, b, alpha)" for a 3- or 6-digit hex; throws on invalid hex. */
export const hexToRgba = (hex: string, alpha: number): string => {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
