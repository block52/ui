/**
 * Display-only labels for a tournament or sit-and-go prize.
 *
 * The chain amount stays in micro-USDC. Labels round DOWN to whole cents so a
 * list of prizes cannot add up to more than the floored pool. Nothing here
 * changes a payout, a fee, or a claim.
 */
import { hasContent, hasValue } from "./guards";

const MICRO_PER_CENT = 10_000n;

/** Authoritative micro-USDC, or null when the wire value is not a whole amount. */
export function parsePrizeMicro(value: string | null | undefined): bigint | null {
    if (!hasContent(value) || !/^\d+$/.test(value)) return null;
    return BigInt(value);
}

/** True when the chain prize is a positive number of micro-USDC, even under one cent. */
export function prizeMicroIsPositive(value: string | null | undefined): value is string {
    const micro = parsePrizeMicro(value);
    return hasValue(micro) && micro > 0n;
}

/** Whole cents, rounded down. One cent is 10,000 micro-USDC. */
export function floorPrizeCents(micro: bigint): bigint {
    if (micro <= 0n) return 0n;
    return micro / MICRO_PER_CENT;
}

function groupDigits(value: bigint): string {
    const text = value.toString();
    let grouped = "";
    for (let index = 0; index < text.length; index++) {
        if (index > 0 && (text.length - index) % 3 === 0) grouped += ",";
        grouped += text[index];
    }
    return grouped;
}

/** "$" omitted. Two decimals. 25200 → "0.02", 36000 → "0.03", 1 → "0.00". */
export function formatFlooredPrizeDollars(micro: bigint): string {
    const cents = floorPrizeCents(micro);
    const whole = cents / 100n;
    const fraction = (cents % 100n).toString().padStart(2, "0");
    return `${groupDigits(whole)}.${fraction}`;
}

/** Sum of per-place floored cents is never above the floored sum. Gaps may remain. */
export function flooredPrizesWithinPool(amounts: readonly string[]): boolean {
    let pool = 0n;
    let places = 0n;
    for (const amount of amounts) {
        const micro = parsePrizeMicro(amount);
        if (!hasValue(micro)) return false;
        pool += micro;
        places += floorPrizeCents(micro);
    }
    return places <= floorPrizeCents(pool);
}
