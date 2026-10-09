/**
 * Colour configuration: every colour can be overridden by a VITE_* variable and falls back to
 * the default below. An override that is not a 3- or 6-digit hex colour is reported with
 * console.error and ignored, so a bad deployment value never breaks rendering.
 */

import { hexToRgba, hexToRgbChannels, mixHex, parseHex } from "./colorMath";
import { viteEnv } from "./viteEnv";

export { hexToRgba };

/** `raw` if it is a valid hex colour, otherwise `fallback` (after logging the bad value). */
export const resolveHexColor = (name: string, raw: string | undefined, fallback: string): string => {
    if (raw === undefined || raw === "") return fallback;
    try {
        parseHex(raw);
        return raw;
    } catch {
        console.error(`${name}="${raw}" is not a 3- or 6-digit hex colour; using ${fallback}`);
        return fallback;
    }
};

const hexEnv = (name: string, fallback: string): string => resolveHexColor(name, viteEnv[name], fallback);

export const colors = {
    brand: {
        primary: hexEnv("VITE_BRAND_COLOR_PRIMARY", "#7c3aed"),
        secondary: hexEnv("VITE_BRAND_COLOR_SECONDARY", "#12131c")
    },

    table: {
        bgGradientStart: hexEnv("VITE_TABLE_BG_GRADIENT_START", "#1a2639"),
        bgGradientMid: hexEnv("VITE_TABLE_BG_GRADIENT_MID", "#2a3f5f"),
        bgGradientEnd: hexEnv("VITE_TABLE_BG_GRADIENT_END", "#1a2639"),
        bgBase: hexEnv("VITE_TABLE_BG_BASE", "#111827"),
        borderColor: hexEnv("VITE_TABLE_BORDER_COLOR", "#3a546d")
    },

    animation: {
        color1: hexEnv("VITE_ANIM_COLOR_1", "#221d3a"),
        color2: hexEnv("VITE_ANIM_COLOR_2", "#1a1830"),
        color3: hexEnv("VITE_ANIM_COLOR_3", "#1e1a36"),
        color4: hexEnv("VITE_ANIM_COLOR_4", "#14131f"),
        color5: hexEnv("VITE_ANIM_COLOR_5", "#191729")
    },

    accent: {
        glow: hexEnv("VITE_ACCENT_COLOR_GLOW", "#64ffda"),
        success: hexEnv("VITE_ACCENT_COLOR_SUCCESS", "#10b981"),
        danger: hexEnv("VITE_ACCENT_COLOR_DANGER", "#ef4444"),
        warning: hexEnv("VITE_ACCENT_COLOR_WARNING", "#f59e0b"),
        withdraw: hexEnv("VITE_ACCENT_COLOR_WITHDRAW", hexEnv("VITE_BRAND_COLOR_SECONDARY", "#1a2639"))
    },

    ui: {
        bgDark: hexEnv("VITE_UI_BG_DARK", "#161722"),
        bgMedium: hexEnv("VITE_UI_BG_MEDIUM", "#232636"),
        borderColor: hexEnv("VITE_UI_BORDER_COLOR", "#262938"),
        textSecondary: hexEnv("VITE_UI_TEXT_SECONDARY", "#8e90a6")
    }
};

export const generateCSSVariables = (): string => {
  return `
    :root {
      --brand-primary: ${colors.brand.primary};
      --brand-primary-10: ${hexToRgba(colors.brand.primary, 0.1)};
      --brand-primary-rgb: ${hexToRgbChannels(colors.brand.primary)};
      --brand-primary-light-rgb: ${hexToRgbChannels(mixHex(colors.brand.primary, "#ffffff", 0.35))};
      --brand-secondary: ${colors.brand.secondary};
      --table-bg-gradient-start: ${colors.table.bgGradientStart};
      --table-bg-gradient-mid: ${colors.table.bgGradientMid};
      --table-bg-gradient-end: ${colors.table.bgGradientEnd};
      --table-bg-base: ${colors.table.bgBase};
      --table-border-color: ${colors.table.borderColor};
      --anim-color-1: ${colors.animation.color1};
      --anim-color-1-10: ${hexToRgba(colors.animation.color1, 0.1)};
      --anim-color-1-80: ${hexToRgba(colors.animation.color1, 0.8)};
      --anim-color-2: ${colors.animation.color2};
      --anim-color-2-10: ${hexToRgba(colors.animation.color2, 0.1)};
      --anim-color-2-70: ${hexToRgba(colors.animation.color2, 0.7)};
      --anim-color-3: ${colors.animation.color3};
      --anim-color-3-70: ${hexToRgba(colors.animation.color3, 0.7)};
      --anim-color-4: ${colors.animation.color4};
      --anim-color-4-10: ${hexToRgba(colors.animation.color4, 0.1)};
      --anim-color-4-70: ${hexToRgba(colors.animation.color4, 0.7)};
      --anim-color-5: ${colors.animation.color5};
      --anim-color-5-10: ${hexToRgba(colors.animation.color5, 0.1)};
      --anim-color-5-70: ${hexToRgba(colors.animation.color5, 0.7)};
      --accent-glow: ${colors.accent.glow};
      --accent-success: ${colors.accent.success};
      --accent-danger: ${colors.accent.danger};
      --accent-warning: ${colors.accent.warning};
      --ui-bg-dark: ${colors.ui.bgDark};
      --ui-bg-medium: ${colors.ui.bgMedium};
      --ui-border-color: ${colors.ui.borderColor};
      --ui-text-secondary: ${colors.ui.textSecondary};
    }
    :root[data-theme="light"] {
      --brand-primary-light-rgb: ${hexToRgbChannels(mixHex(colors.brand.primary, "#000000", 0.3))};
      --brand-secondary: #ffffff;
      --ui-bg-dark: #ffffff;
      --ui-bg-medium: #f1f2f7;
      --ui-border-color: #e3e4ee;
      --ui-text-secondary: #6b6f86;
    }
  `;
};

export const getTableHeaderGradient = (): string => {
  return `linear-gradient(to right, ${colors.table.bgGradientStart}, ${colors.table.bgGradientMid}, ${colors.table.bgGradientEnd})`;
};

export const getAnimationGradient = (mouseX: number, mouseY: number): string => {
  return `
    radial-gradient(circle at ${mouseX}% ${mouseY}%, ${hexToRgba(colors.animation.color1, 0.8)} 0%, transparent 60%),
    radial-gradient(circle at 0% 0%, ${hexToRgba(colors.animation.color2, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 100% 0%, ${hexToRgba(colors.animation.color3, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 0% 100%, ${hexToRgba(colors.animation.color4, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, ${hexToRgba(colors.animation.color5, 0.7)} 0%, transparent 50%)
  `;
};

export const getHexagonStroke = (): string => {
  return hexToRgba(colors.brand.primary, 0.5);
};