/** Display only. Never parse these labels back into transaction amounts or limits. */
type MoneyValue = string | number | bigint;

function centsLabel(cents: bigint, grouped: boolean): string {
    const sign = cents < 0n ? "-" : "";
    const absolute = cents < 0n ? -cents : cents;
    const whole = (absolute / 100n).toString();
    return `${sign}${grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

/** Mathematical ceiling, including negative net results; no floating-point multiplication. */
function ceilingCents(value: MoneyValue, decimalShift: number): bigint | null {
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    // Remove binary arithmetic noise at exact cents, without discarding real sub-cent amounts.
    if (typeof value === "number" && decimalShift === 0) {
        const nearest = Math.round(value * 100) / 100;
        if (Math.abs(value - nearest) <= Number.EPSILON * Math.abs(value) * 2) value = nearest;
    }
    const match = String(value)
        .trim()
        .match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if (!match || !(match[2] || match[3])) return null;
    const fraction = match[3] || "";
    const exponent = Number(match[4] || 0) + 2 - decimalShift - fraction.length;
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return null;
    const coefficient = BigInt((match[2] || "0") + fraction) * (match[1] === "-" ? -1n : 1n);
    if (exponent >= 0) return coefficient * 10n ** BigInt(exponent);
    const divisor = 10n ** BigInt(-exponent);
    return coefficient / divisor + (coefficient > 0n && coefficient % divisor !== 0n ? 1n : 0n);
}

/** Dollar/USDC label, rounded UP to cents. Missing/invalid data is not a zero balance. */
export function formatUsd(value: MoneyValue, grouped = false): string {
    const cents = ceilingCents(value, 0);
    return cents === null ? "—" : centsLabel(cents, grouped);
}

/** Exact USDC micro-unit label. Pass wire strings/bigints to preserve large balances. */
export function formatMicroUsd(value: MoneyValue, grouped = false): string {
    const cents = ceilingCents(value, 6);
    return cents === null ? "—" : centsLabel(cents, grouped);
}
