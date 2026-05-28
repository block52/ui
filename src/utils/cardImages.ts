/**
 * Card image URL utility
 *
 * Card SVGs and card backs are bundled with the app (Vite static imports) so gameplay-critical
 * art is never blocked on a third-party CDN. Non-critical assets (chips, sounds, dealer button)
 * are served from jsDelivr — a real edge CDN backed by the block52/cards GitHub repo —
 * rather than raw.githubusercontent.com, which is not a CDN and has rate limits / intermittent 5xx.
 */

import as2C from "../assets/cards/2C.svg";
import as2D from "../assets/cards/2D.svg";
import as2H from "../assets/cards/2H.svg";
import as2S from "../assets/cards/2S.svg";
import as3C from "../assets/cards/3C.svg";
import as3D from "../assets/cards/3D.svg";
import as3H from "../assets/cards/3H.svg";
import as3S from "../assets/cards/3S.svg";
import as4C from "../assets/cards/4C.svg";
import as4D from "../assets/cards/4D.svg";
import as4H from "../assets/cards/4H.svg";
import as4S from "../assets/cards/4S.svg";
import as5C from "../assets/cards/5C.svg";
import as5D from "../assets/cards/5D.svg";
import as5H from "../assets/cards/5H.svg";
import as5S from "../assets/cards/5S.svg";
import as6C from "../assets/cards/6C.svg";
import as6D from "../assets/cards/6D.svg";
import as6H from "../assets/cards/6H.svg";
import as6S from "../assets/cards/6S.svg";
import as7C from "../assets/cards/7C.svg";
import as7D from "../assets/cards/7D.svg";
import as7H from "../assets/cards/7H.svg";
import as7S from "../assets/cards/7S.svg";
import as8C from "../assets/cards/8C.svg";
import as8D from "../assets/cards/8D.svg";
import as8H from "../assets/cards/8H.svg";
import as8S from "../assets/cards/8S.svg";
import as9C from "../assets/cards/9C.svg";
import as9D from "../assets/cards/9D.svg";
import as9H from "../assets/cards/9H.svg";
import as9S from "../assets/cards/9S.svg";
import asTC from "../assets/cards/TC.svg";
import asTD from "../assets/cards/TD.svg";
import asTH from "../assets/cards/TH.svg";
import asTS from "../assets/cards/TS.svg";
import asJC from "../assets/cards/JC.svg";
import asJD from "../assets/cards/JD.svg";
import asJH from "../assets/cards/JH.svg";
import asJS from "../assets/cards/JS.svg";
import asQC from "../assets/cards/QC.svg";
import asQD from "../assets/cards/QD.svg";
import asQH from "../assets/cards/QH.svg";
import asQS from "../assets/cards/QS.svg";
import asKC from "../assets/cards/KC.svg";
import asKD from "../assets/cards/KD.svg";
import asKH from "../assets/cards/KH.svg";
import asKS from "../assets/cards/KS.svg";
import asAC from "../assets/cards/AC.svg";
import asAD from "../assets/cards/AD.svg";
import asAH from "../assets/cards/AH.svg";
import asAS from "../assets/cards/AS.svg";
import b52CardBackSvg from "../assets/cards/b52CardBack.svg";
import backLegacySvg from "../assets/cards/Back.svg";
import backCustomSvg from "../assets/cards/BackCustom.svg";

// jsDelivr CDN against the block52/cards GitHub repo — edge-cached, unlike raw.githubusercontent.com.
const CDN_BASE = "https://cdn.jsdelivr.net/gh/block52/cards@main";

const CARD_IMAGES: Record<string, string> = {
    "2C": as2C, "2D": as2D, "2H": as2H, "2S": as2S,
    "3C": as3C, "3D": as3D, "3H": as3H, "3S": as3S,
    "4C": as4C, "4D": as4D, "4H": as4H, "4S": as4S,
    "5C": as5C, "5D": as5D, "5H": as5H, "5S": as5S,
    "6C": as6C, "6D": as6D, "6H": as6H, "6S": as6S,
    "7C": as7C, "7D": as7D, "7H": as7H, "7S": as7S,
    "8C": as8C, "8D": as8D, "8H": as8H, "8S": as8S,
    "9C": as9C, "9D": as9D, "9H": as9H, "9S": as9S,
    "TC": asTC, "TD": asTD, "TH": asTH, "TS": asTS,
    "JC": asJC, "JD": asJD, "JH": asJH, "JS": asJS,
    "QC": asQC, "QD": asQD, "QH": asQH, "QS": asQS,
    "KC": asKC, "KD": asKD, "KH": asKH, "KS": asKS,
    "AC": asAC, "AD": asAD, "AH": asAH, "AS": asAS
};

/**
 * Available card back styles
 */
export type CardBackStyle = "default" | "block52" | "custom" | string;

/**
 * Get the URL for a chip image by filename (e.g. "25chip.svg", "1cent.svg")
 */
export function getChipImageUrl(file: string): string {
    return `${CDN_BASE}/chips/${file}`;
}

/**
 * Get the URL for the generic chip image (chip.svg)
 */
export function getGenericChipImageUrl(): string {
    return `${CDN_BASE}/chips/chip.svg`;
}

/**
 * Get the URL for a sound file by filename (e.g. "chip-notification.mp3")
 */
export function getSoundUrl(file: string): string {
    return `${CDN_BASE}/sounds/${file}`;
}

/**
 * Get the URL for the dealer button image
 */
export function getDealerImageUrl(): string {
    return `${CDN_BASE}/dealer.svg`;
}

/**
 * Get the URL for a card image
 * @param cardCode - The card code (e.g., "AS" for Ace of Spades, "TC" for Ten of Clubs)
 * @returns Bundled URL for the card SVG, or the default card back for empty / unknown codes
 */
export function getCardImageUrl(cardCode: string): string {
    if (!cardCode || cardCode === "??") {
        return b52CardBackSvg;
    }
    return CARD_IMAGES[cardCode] ?? b52CardBackSvg;
}

/**
 * Get the URL for the card back image
 * @param style - The card back style to use (default, block52, legacy, custom, or a custom URL)
 */
export function getCardBackUrl(style?: CardBackStyle): string {
    if (!style || style === "default" || style === "block52") {
        return b52CardBackSvg;
    }
    if (style === "custom") {
        return backCustomSvg;
    }
    if (style === "legacy") {
        return backLegacySvg;
    }
    // Support custom URLs (e.g., for club-specific branding)
    return style;
}

/**
 * Preload card images for better UX. With bundled assets the browser will warm
 * its cache for the hashed URLs, which keeps deal-time renders snappy.
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
    preloadCardImages(Object.keys(CARD_IMAGES));
    const back = new Image();
    back.src = b52CardBackSvg;
}
