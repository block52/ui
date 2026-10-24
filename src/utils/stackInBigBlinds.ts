/**
 * Show a stack in big blinds (ui#895).
 *
 * Both values must be in the same unit: dollars for cash games (after the
 * micro-USDC conversion), chips for tournaments. Returns null when there is no
 * usable big blind, so the caller can fall back to the plain $ / chip amount.
 */
export const stackInBigBlinds = (stack: number, bigBlind: number): number | null => {
    if (!Number.isFinite(stack) || !Number.isFinite(bigBlind) || bigBlind <= 0) return null;
    return stack / bigBlind;
};

/** "45.5 BB", "100 BB", "0.5 BB" — one decimal place, dropped when it's a whole number. */
export const formatBigBlinds = (bigBlinds: number): string => {
    const rounded = Math.round(bigBlinds * 10) / 10;
    const text = Number.isInteger(rounded) ? rounded.toLocaleString("en-US") : rounded.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${text} BB`;
};
