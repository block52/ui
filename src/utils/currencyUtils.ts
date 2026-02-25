/**
 * Convert a human-readable token amount to its smallest unit (BigInt string).
 * e.g. toSmallestUnit(1.5, 6) => "1500000"
 */
export function toSmallestUnit(amount: number, decimals: number): string {
    const parts = amount.toString().split(".");
    const whole = parts[0];
    const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + frac).toString();
}

/**
 * Convert ETH amount to wei string.
 * e.g. ethToWei(0.01) => "10000000000000000"
 */
export function ethToWei(amount: number): string {
    return toSmallestUnit(amount, 18);
}
