/**
 * Card image URL utility
 *
 * Provides card image URLs from GitHub CDN as a fallback for production deployments
 * where the /cards/ folder may not be properly served.
 */

const GITHUB_CDN_BASE = "https://raw.githubusercontent.com/block52/cards/main";

// Default card back image
const DEFAULT_CARD_BACK = "b52CardBack.svg";

/**
 * Available card back styles
 */
export type CardBackStyle = "default" | "block52" | "custom" | string;

/**
 * Get the URL for the chip image
 * @returns The URL to the chip SVG image
 */
export function getChipImageUrl(): string {
    return `${GITHUB_CDN_BASE}/chip.svg`;
}

/**
 * Get the URL for the dealer button image
 * @returns The URL to the dealer SVG image
 */
export function getDealerImageUrl(): string {
    return `${GITHUB_CDN_BASE}/dealer.svg`;
}

/**
 * Get the URL for a card image
 * @param cardCode - The card code (e.g., "AS" for Ace of Spades, "TC" for Ten of Clubs)
 * @param useLocalFirst - If true, tries local path first (for development)
 * @returns The URL to the card SVG image
 */
export function getCardImageUrl(cardCode: string): string {
    if (!cardCode || cardCode === "??" || cardCode === "") {
        return `${GITHUB_CDN_BASE}/${DEFAULT_CARD_BACK}`;
    }
    return `${GITHUB_CDN_BASE}/${cardCode}.svg`;
}

/**
 * Get the URL for the card back image
 * @param style - The card back style to use (default, block52, custom, or a custom URL)
 * @returns The URL to the card back SVG image
 * @example
 * getCardBackUrl() // Returns default b52CardBack.svg
 * getCardBackUrl("block52") // Returns b52CardBack.svg
 * getCardBackUrl("legacy") // Returns Back.svg
 * getCardBackUrl("custom") // Returns BackCustom.svg
 * getCardBackUrl("https://example.com/my-card-back.svg") // Returns custom URL
 */
export function getCardBackUrl(style?: CardBackStyle): string {
    // If no style specified, use default (b52CardBack)
    if (!style || style === "default" || style === "block52") {
        return `${GITHUB_CDN_BASE}/${DEFAULT_CARD_BACK}`;
    }

    // Custom/TexasHODL card back
    if (style === "custom") {
        return `${GITHUB_CDN_BASE}/BackCustom.svg`;
    }

    // Legacy Back.svg option
    if (style === "legacy") {
        return `${GITHUB_CDN_BASE}/Back.svg`;
    }

    // Support custom URLs (e.g., for club-specific branding)
    return style;
}

/**
 * Preload card images for better UX
 * @param cardCodes - Array of card codes to preload
 */
export function preloadCardImages(cardCodes: string[]): void {
    cardCodes.forEach(code => {
        const img = new Image();
        img.src = getCardImageUrl(code);
    });
}

/**
 * Preload all card images (52 cards + back)
 */
export function preloadAllCards(): void {
    const suits = ["C", "D", "H", "S"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

    const allCards = suits.flatMap(suit => ranks.map(rank => `${rank}${suit}`));

    // Add card back
    allCards.push("Back");

    preloadCardImages(allCards);
}
