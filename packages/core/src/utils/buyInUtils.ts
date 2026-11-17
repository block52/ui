/**
 * Buy-in calculation utilities for poker games.
 *
 * Buy-in limits are defined in Big Blinds (BB) and calculated
 * dynamically based on the table's stake level.
 */

import { parseMicroToBigInt } from "../constants/currency";

/** Basis-points denominator (10000 = 100%). protocolFeeBps of 1000 = 10%. */
export const BPS_DENOMINATOR = 10000n;

/**
 * Sit & Go entry-cost breakdown, all amounts in USDC micro-units (bigint).
 *
 * The protocol fee is skimmed OUT OF the buy-in (it is NOT added on top): the
 * prize-pool portion is `buyIn - protocolCut`. The owner fee (`entryFee`) is an
 * additional charge that goes to the game creator. Total entry cost is
 * `buyIn + ownerFee` — the protocol cut lives inside the buy-in.
 *
 * Mirrors the on-chain math (poker-vm#2592): `protocolCut = buyIn * bps / 10000`
 * with floor division; dust stays in the prize-pool portion.
 */
export interface SngEntryBreakdown {
    /** Buy-in portion that reaches the prize pool: buyIn - protocolCut. */
    prizePoolPortion: bigint;
    /** Protocol fee skimmed from the buy-in to validators: buyIn * bps / 10000 (floor). */
    protocolCut: bigint;
    /** Owner/creator fee (entryFee), charged on top of the buy-in. Unchanged path. */
    ownerFee: bigint;
    /** Total entry cost the player pays: buyIn + ownerFee. */
    total: bigint;
    /** Whether a non-zero protocol fee applies (bps present and > 0). */
    hasProtocolFee: boolean;
}

/**
 * Compute the Sit & Go entry-cost breakdown in micro-USDC bigint discipline.
 *
 * @param buyIn - Fixed SNG buy-in in micro-USDC (string DTO / number / bigint).
 * @param entryFee - Owner fee in micro-USDC (string DTO / number / bigint); absent/0 = no owner fee.
 * @param protocolFeeBps - Protocol fee rate in basis points (1000 = 10%); absent/0 = no protocol fee.
 * @returns Breakdown with prize-pool portion, protocol cut, owner fee, and total.
 *
 * @example
 * // $9 buy-in, 10% protocol fee, $1 owner fee (micro-USDC)
 * computeSngEntryBreakdown("9000000", "1000000", 1000)
 * // => { prizePoolPortion: 8100000n, protocolCut: 900000n, ownerFee: 1000000n, total: 10000000n, hasProtocolFee: true }
 */
export function computeSngEntryBreakdown(
    buyIn: string | number | bigint | undefined,
    entryFee: string | number | bigint | undefined,
    protocolFeeBps: number | undefined
): SngEntryBreakdown {
    const buyInMicro = parseMicroToBigInt(buyIn);
    const ownerFee = parseMicroToBigInt(entryFee);

    // bps is a small safe integer (Commandment #10). Guard absent/0/negative.
    const bps = protocolFeeBps && protocolFeeBps > 0 ? BigInt(protocolFeeBps) : 0n;
    const hasProtocolFee = bps > 0n;

    // Floor division mirrors the chain: dust stays in the prize-pool portion.
    const protocolCut = hasProtocolFee ? (buyInMicro * bps) / BPS_DENOMINATOR : 0n;
    const prizePoolPortion = buyInMicro - protocolCut;

    return {
        prizePoolPortion,
        protocolCut,
        ownerFee,
        total: buyInMicro + ownerFee,
        hasProtocolFee
    };
}

export interface BuyInConfig {
    minBuyInBB: number;  // Minimum buy-in in Big Blinds
    maxBuyInBB: number;  // Maximum buy-in in Big Blinds
    bigBlind: number;    // Big blind amount in dollars
}

export interface CalculatedBuyIn {
    minBuyIn: number;    // Calculated minimum buy-in in dollars
    maxBuyIn: number;    // Calculated maximum buy-in in dollars
}

/**
 * Calculate actual buy-in amounts from BB-based configuration.
 *
 * @param config - Buy-in configuration with BB values and big blind amount
 * @returns Calculated buy-in amounts in dollars
 *
 * @example
 * // $0.01/$0.02 game with 20-100 BB buy-in
 * calculateBuyIn({ minBuyInBB: 20, maxBuyInBB: 100, bigBlind: 0.02 })
 * // Returns: { minBuyIn: 0.40, maxBuyIn: 2.00 }
 *
 * @example
 * // $1/$2 game with 50-200 BB buy-in
 * calculateBuyIn({ minBuyInBB: 50, maxBuyInBB: 200, bigBlind: 2 })
 * // Returns: { minBuyIn: 100, maxBuyIn: 400 }
 */
export function calculateBuyIn(config: BuyInConfig): CalculatedBuyIn {
    const { minBuyInBB, maxBuyInBB, bigBlind } = config;

    return {
        minBuyIn: minBuyInBB * bigBlind,
        maxBuyIn: maxBuyInBB * bigBlind
    };
}

/**
 * Validate buy-in BB configuration.
 *
 * @param minBuyInBB - Minimum buy-in in Big Blinds
 * @param maxBuyInBB - Maximum buy-in in Big Blinds
 * @returns Object with isValid flag and optional error message
 */
export function validateBuyInBB(minBuyInBB: number, maxBuyInBB: number): { isValid: boolean; error?: string } {
    if (minBuyInBB < 20) {
        return { isValid: false, error: "Minimum buy-in must be at least 20 BB" };
    }

    if (maxBuyInBB > 500) {
        return { isValid: false, error: "Maximum buy-in cannot exceed 500 BB" };
    }

    if (minBuyInBB >= maxBuyInBB) {
        return { isValid: false, error: "Minimum buy-in must be less than maximum buy-in" };
    }

    return { isValid: true };
}

/**
 * Common buy-in presets used in standard poker games.
 */
export const BUY_IN_PRESETS = {
    STANDARD: { minBuyInBB: 20, maxBuyInBB: 100, label: "Standard (20-100 BB)" },
    DEEP: { minBuyInBB: 40, maxBuyInBB: 200, label: "Deep (40-200 BB)" },
    DEEP_STACK: { minBuyInBB: 100, maxBuyInBB: 300, label: "Deep Stack (100-300 BB)" }
} as const;

/**
 * Format buy-in range as a display string.
 *
 * @param minBuyIn - Minimum buy-in in dollars
 * @param maxBuyIn - Maximum buy-in in dollars
 * @returns Formatted string like "$20.00 - $100.00"
 */
export function formatBuyInRange(minBuyIn: number, maxBuyIn: number): string {
    return `$${minBuyIn.toFixed(2)} - $${maxBuyIn.toFixed(2)}`;
}
