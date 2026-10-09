/**
 * Shared utility functions for Table components
 *
 * This file contains utility functions used across the split Table components.
 */

import { copyToClipboard as copyToClipboardUtil } from "../../../utils/clipboard";
import { colors, hexToRgba } from "../../../utils/colorConfig";

export const copyToClipboard = (text: string, successMessage?: string): void => {
    void copyToClipboardUtil(text, successMessage);
};

/**
 * Navigate to lobby/dashboard
 */
export const navigateToLobby = (): void => {
    window.location.href = "/";
};

/**
 * Get header style with gradient background
 */
export const getHeaderStyle = (): React.CSSProperties => {
    return {
        background: `linear-gradient(135deg, ${hexToRgba(colors.ui.bgDark, 0.95)} 0%, ${hexToRgba(colors.ui.bgMedium, 0.9)} 100%)`,
        backdropFilter: "blur(10px)",
        boxShadow: `0 4px 20px ${hexToRgba(colors.brand.primary, 0.15)}`,
        borderColor: hexToRgba(colors.brand.primary, 0.2)
    };
};

/**
 * Get sub-header style
 */
export const getSubHeaderStyle = (): React.CSSProperties => {
    return {
        background: `linear-gradient(180deg, ${hexToRgba(colors.ui.bgMedium, 0.8)} 0%, ${hexToRgba(colors.ui.bgDark, 0.9)} 100%)`,
        borderBottom: `1px solid ${hexToRgba(colors.brand.primary, 0.2)}`
    };
};

/**
 * Get wallet info style
 */
export const getWalletInfoStyle = (): React.CSSProperties => {
    return {
        backgroundColor: hexToRgba(colors.ui.bgMedium, 0.6),
        border: `1px solid ${hexToRgba(colors.brand.primary, 0.3)}`,
        boxShadow: `0 0 10px ${hexToRgba(colors.brand.primary, 0.1)}`
    };
};

/**
 * Get balance icon style
 */
export const getBalanceIconStyle = (): React.CSSProperties => {
    return {
        backgroundColor: hexToRgba(colors.brand.primary, 0.15),
        border: `1px solid ${colors.brand.primary}`
    };
};

/**
 * Get deposit button style
 */
export const getDepositButtonStyle = (isHovered: boolean): React.CSSProperties => {
    return {
        backgroundColor: isHovered ? hexToRgba(colors.brand.primary, 0.3) : hexToRgba(colors.brand.primary, 0.15),
        borderColor: colors.brand.primary,
        color: colors.brand.primary,
        boxShadow: isHovered ? `0 0 15px ${hexToRgba(colors.brand.primary, 0.5)}` : "none"
    };
};

/**
 * Check if viewport is mobile landscape
 */
export const isMobileLandscape = (): boolean => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 926 && window.innerWidth > window.innerHeight;
};
