import { isNullish } from "../utils/guards";
/**
 * Currency conversion constants for USDC
 *
 * USDC uses 6 decimal places (micro-denominations)
 * 1 USDC = 1,000,000 micro-USDC
 *
 * All internal calculations should use bigint with 10^6 precision.
 * Convert to string only when sending over the wire (JSON serialization).
 * Convert to number only for display purposes.
 */

/** Number of micro-units per 1 USDC (10^6) */
export const USDC_DECIMALS = 6;

/** Conversion factor: 1 USDC = 1,000,000 micro-USDC */
export const USDC_TO_MICRO = 1_000_000;

/** Conversion factor as bigint for precise calculations */
export const USDC_TO_MICRO_BIGINT = 1_000_000n;

/** Conversion factor: 1 micro-USDC = 0.000001 USDC */
export const MICRO_TO_USDC = 1 / 1_000_000;

/**
 * Parse a decimal USDC string to micro-units, exactly.
 *
 * PREFER THIS over {@link usdcToMicroBigInt} wherever the amount originates as
 * text — user input, form state, an API field. It never constructs a float, so
 * there is no precision to lose: the digits are moved and the result is built
 * from them.
 *
 * The float route cannot do this. `2.01` is not representable in binary; the
 * nearest double times 10^6 is 2009999.9999999998, and flooring that yields
 * 2009999. Converting to bigint afterwards is too late (#610).
 *
 * @param value Decimal USDC as text, e.g. "2.01". Up to 6 decimal places.
 * @returns Amount in micro-units, e.g. 2010000n
 * @throws If the value is not a plain non-negative decimal, or carries more
 *         precision than USDC has. It refuses rather than truncating, because
 *         silently dropping a digit is silently taking money.
 */
export function parseUsdcToMicro(value: string): bigint {
    const text = (value ?? "").trim().replace(/^\+/, "");
    if (text === "") {
        throw new Error("parseUsdcToMicro: amount is empty");
    }
    if (text.startsWith("-")) {
        throw new Error(`parseUsdcToMicro: amount cannot be negative (got "${value}")`);
    }
    // Deliberately strict: no exponents, no thousands separators, no currency
    // symbols. Callers should validate and normalise their own input rather
    // than have this quietly reinterpret it.
    if (!/^\d*\.?\d*$/.test(text) || text === ".") {
        throw new Error(`parseUsdcToMicro: "${value}" is not a valid decimal amount`);
    }

    const [whole = "", fraction = ""] = text.split(".");
    if (fraction.length > USDC_DECIMALS) {
        throw new Error(
            `parseUsdcToMicro: "${value}" has more than ${USDC_DECIMALS} decimal places, which USDC cannot represent`
        );
    }

    // Right-pad the fraction to exactly 6 digits and concatenate: no arithmetic
    // on anything that could round.
    return BigInt(`${whole || "0"}${fraction.padEnd(USDC_DECIMALS, "0")}`);
}

/**
 * Convert USDC dollars to micro-units (bigint).
 *
 * Use {@link parseUsdcToMicro} instead when the amount is available as a string
 * — this entry point exists for values that are genuinely numeric (a slider
 * position, a computed limit) and it cannot be exact for those by construction.
 *
 * Rounds to the nearest micro-unit. It previously floored, which turned the
 * float representation error into a systematic one-unit shortfall on 1.2% of
 * ordinary cent amounts (#610). Rounding recovers the intended value for any
 * decimal within USDC precision, because the representation error is many
 * orders of magnitude below half a micro-unit.
 *
 * @param usdcAmount Amount in USDC (e.g., 1.50)
 * @returns Amount in micro-units as bigint (e.g., 1500000n)
 * @throws If the value is not finite, or is too large to convert without losing
 *         precision — better a loud failure than a wrong amount.
 */
export function usdcToMicroBigInt(usdcAmount: number): bigint {
    if (!Number.isFinite(usdcAmount)) {
        throw new Error(`usdcToMicroBigInt: expected a finite number, got ${usdcAmount}`);
    }
    const micro = Math.round(usdcAmount * USDC_TO_MICRO);
    if (!Number.isSafeInteger(micro)) {
        throw new Error(`usdcToMicroBigInt: ${usdcAmount} USDC exceeds the precision a number can carry`);
    }
    return BigInt(micro);
}

/**
 * Convert USDC dollars to micro-units
 * @param usdcAmount Amount in USDC (e.g., 1.50)
 * @returns Amount in micro-units (e.g., 1500000)
 * @deprecated Use usdcToMicroBigInt for internal calculations
 */
export function usdcToMicro(usdcAmount: number): number {
    // Rounds, for the same reason as usdcToMicroBigInt (#610).
    return Math.round(usdcAmount * USDC_TO_MICRO);
}

/**
 * Convert micro-units (bigint) to USDC dollars for display
 * @param microAmount Amount in micro-units as bigint (e.g., 1500000n)
 * @returns Amount in USDC as number (e.g., 1.50)
 */
export function microBigIntToUsdc(microAmount: bigint): number {
    return Number(microAmount) / USDC_TO_MICRO;
}

/**
 * Convert micro-units to USDC dollars
 * @param microAmount Amount in micro-units (e.g., 1500000)
 * @returns Amount in USDC (e.g., 1.50)
 */
export function microToUsdc(microAmount: number | string | bigint): number {
    if (typeof microAmount === "bigint") {
        return Number(microAmount) / USDC_TO_MICRO;
    }
    const amount = typeof microAmount === "string" ? parseFloat(microAmount) : microAmount;
    return amount / USDC_TO_MICRO;
}

/**
 * Parse a micro-unit value (string, number, or bigint) to bigint
 * Use this when receiving values from the API/wire format
 * @param value The value to parse
 * @returns The value as bigint
 */
export function parseMicroToBigInt(value: string | number | bigint | undefined): bigint {
    if (isNullish(value)) return 0n;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.floor(value));
    // Handle string - remove any decimal places (shouldn't have any for micro-units)
    const parsed = value.includes(".") ? value.split(".")[0] : value;
    return BigInt(parsed || "0");
}

/**
 * Convert bigint micro-units to string for wire transmission (JSON)
 * @param microAmount Amount in micro-units as bigint
 * @returns String representation for JSON serialization
 */
export function microBigIntToString(microAmount: bigint): string {
    return microAmount.toString();
}

/**
 * Format micro-units as USDC with specified decimal places
 * @param microAmount Amount in micro-units
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted USDC string (e.g., "1.50")
 */
export function formatMicroAsUsdc(microAmount: number | string | bigint, decimals: number = 2): string {
    return microToUsdc(microAmount).toFixed(decimals);
}
