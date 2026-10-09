/**
 * Color Configuration Utility
 * 
 * This file centralizes all color management for the application.
 * Colors can be customized via environment variables with fallback defaults.
 */

import { hexToRgbChannels, mixHex } from "./colorMath";

// Brand Colors
export const colors = {
  // Primary and Secondary Brand Colors
  brand: {
    primary: import.meta.env.VITE_BRAND_COLOR_PRIMARY || "#7c3aed",
    secondary: import.meta.env.VITE_BRAND_COLOR_SECONDARY || "#12131c",
  },

  // Table Background Colors
  table: {
    bgGradientStart: import.meta.env.VITE_TABLE_BG_GRADIENT_START || "#1a2639",
    bgGradientMid: import.meta.env.VITE_TABLE_BG_GRADIENT_MID || "#2a3f5f",
    bgGradientEnd: import.meta.env.VITE_TABLE_BG_GRADIENT_END || "#1a2639",
    bgBase: import.meta.env.VITE_TABLE_BG_BASE || "#111827",
    borderColor: import.meta.env.VITE_TABLE_BORDER_COLOR || "#3a546d",
  },

  // Animation Colors (for gradient backgrounds)
  animation: {
    color1: import.meta.env.VITE_ANIM_COLOR_1 || "#221d3a",
    color2: import.meta.env.VITE_ANIM_COLOR_2 || "#1a1830",
    color3: import.meta.env.VITE_ANIM_COLOR_3 || "#1e1a36",
    color4: import.meta.env.VITE_ANIM_COLOR_4 || "#14131f",
    color5: import.meta.env.VITE_ANIM_COLOR_5 || "#191729",
  },

  // Accent Colors
  accent: {
    glow: import.meta.env.VITE_ACCENT_COLOR_GLOW || "#64ffda",
    success: import.meta.env.VITE_ACCENT_COLOR_SUCCESS || "#10b981",
    danger: import.meta.env.VITE_ACCENT_COLOR_DANGER || "#ef4444",
    warning: import.meta.env.VITE_ACCENT_COLOR_WARNING || "#f59e0b",
    withdraw: import.meta.env.VITE_ACCENT_COLOR_WITHDRAW || (import.meta.env.VITE_BRAND_COLOR_SECONDARY || "#1a2639"),
  },

  // UI Element Colors
  ui: {
    bgDark: import.meta.env.VITE_UI_BG_DARK || "#161722",
    bgMedium: import.meta.env.VITE_UI_BG_MEDIUM || "#232636",
    borderColor: import.meta.env.VITE_UI_BORDER_COLOR || "#262938",
    textSecondary: import.meta.env.VITE_UI_TEXT_SECONDARY || "#8e90a6"
  },
};

// Helper function to convert hex to rgba
export const hexToRgba = (hex: string | undefined, alpha: number): string => {
  if (!hex || !hex.startsWith("#")) {
    return `rgba(0, 0, 0, ${alpha})`; // Fallback to transparent black
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Get color with opacity
export const getColorWithOpacity = (colorKey: string, opacity: number): string => {
  const color = colorKey.split(".").reduce((obj, key) => obj[key], colors as any);
  if (color && color.startsWith("#")) {
    return hexToRgba(color, opacity);
  }
  return color;
};

// CSS custom properties generator
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
  `;
};

// Table header gradient
export const getTableHeaderGradient = (): string => {
  return `linear-gradient(to right, ${colors.table.bgGradientStart}, ${colors.table.bgGradientMid}, ${colors.table.bgGradientEnd})`;
};

// Animation background gradients
export const getAnimationGradient = (mouseX: number, mouseY: number): string => {
  return `
    radial-gradient(circle at ${mouseX}% ${mouseY}%, ${hexToRgba(colors.animation.color1, 0.8)} 0%, transparent 60%),
    radial-gradient(circle at 0% 0%, ${hexToRgba(colors.animation.color2, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 100% 0%, ${hexToRgba(colors.animation.color3, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 0% 100%, ${hexToRgba(colors.animation.color4, 0.7)} 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, ${hexToRgba(colors.animation.color5, 0.7)} 0%, transparent 50%)
  `;
};

// Hexagon pattern stroke color
export const getHexagonStroke = (): string => {
  return hexToRgba(colors.brand.primary, 0.5);
};