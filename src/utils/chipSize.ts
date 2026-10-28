/** Chip image size in stage pixels: 28 normally, 32 on phone-sized windows. */
export const CHIP_SIZE = 28;
export const CHIP_SIZE_MOBILE = 32;

/** One chip's size for the current window. */
export function chipSizeForViewport(): number {
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
    return isMobile ? CHIP_SIZE_MOBILE : CHIP_SIZE;
}

/** Dealer button size: 20% larger than one chip (34 desktop / 38 mobile). Matches seatEnvelope's buttonW. */
export function dealerButtonSizeForViewport(): number {
    return Math.round(chipSizeForViewport() * 1.2);
}
