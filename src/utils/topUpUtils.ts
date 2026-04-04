/**
 * Top-up calculation utilities for poker games.
 *
 * These utilities handle the calculation of minimum and maximum
 * top-up amounts, ensuring proper rounding to avoid micro-unit
 * precision issues.
 */

/**
 * Floor a dollar amount to the nearest cent.
 *
 * This prevents display/validation mismatches where a displayed amount
 * (e.g., "$0.70") exceeds the actual micro-unit balance (e.g., 699996 µUSDC).
 *
 * @param amount - Dollar amount to floor
 * @returns Amount floored to nearest $0.01
 *
 * @example
 * floorToCents(0.699996) // Returns 0.69
 * floorToCents(1.999)    // Returns 1.99
 * floorToCents(5.00)     // Returns 5.00
 */
export function floorToCents(amount: number): number {
    return Math.floor(amount * 100) / 100;
}

/**
 * Calculate the minimum top-up amount.
 *
 * If the player's current stack is below the table minimum buy-in,
 * they must top up at least enough to reach the minimum. Otherwise,
 * the minimum top-up is $0.01.
 *
 * @param currentStack - Player's current stack in dollars
 * @param minBuyIn - Table minimum buy-in in dollars
 * @returns Minimum top-up amount in dollars
 *
 * @example
 * // Player below minimum buy-in
 * calculateMinTopUp(0.20, 0.40) // Returns 0.20 (needs $0.20 to reach min)
 *
 * // Player at or above minimum buy-in
 * calculateMinTopUp(1.00, 0.40) // Returns 0.01
 */
export function calculateMinTopUp(currentStack: number, minBuyIn: number): number {
    return currentStack < minBuyIn ? minBuyIn - currentStack : 0.01;
}

/**
 * Calculate the maximum top-up amount.
 *
 * The maximum is capped by both:
 * 1. The room remaining to reach table maximum buy-in
 * 2. The player's wallet balance
 *
 * The result is floored to the nearest cent to ensure the displayed
 * amount is always purchasable with the actual micro-unit balance.
 *
 * @param currentStack - Player's current stack in dollars
 * @param maxBuyIn - Table maximum buy-in in dollars
 * @param walletBalance - Player's wallet balance in dollars
 * @returns Maximum top-up amount in dollars (floored to cents)
 *
 * @example
 * // Wallet is limiting factor
 * calculateMaxTopUp(0, 10, 5) // Returns 5.00
 *
 * // Room to max is limiting factor
 * calculateMaxTopUp(8, 10, 100) // Returns 2.00
 *
 * // Wallet has precision issues
 * calculateMaxTopUp(0, 10, 0.699996) // Returns 0.69 (floored)
 */
export function calculateMaxTopUp(currentStack: number, maxBuyIn: number, walletBalance: number): number {
    const roomToMax = maxBuyIn - currentStack;
    const rawMax = Math.min(roomToMax, walletBalance);
    return floorToCents(rawMax);
}
