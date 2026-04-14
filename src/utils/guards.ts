/**
 * Type guard utilities for common null/undefined/empty checks.
 * Mirrors pvm/ts/src/utils/guards.ts for consistency across the stack.
 * See: https://github.com/block52/poker-vm/pull/1975
 */

/**
 * Check if value is neither null nor undefined.
 * @example
 * if (hasValue(player)) { player.doSomething(); }
 */
export function hasValue<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Check if value is null or undefined.
 * @example
 * if (isNullish(player)) { throw new Error("Player not found"); }
 */
export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

/**
 * Check if array is empty (length === 0).
 * Also handles null/undefined arrays safely.
 * @example
 * if (isEmpty(actions)) { return; }
 */
export function isEmpty<T>(arr: T[] | null | undefined): boolean {
    return !arr || arr.length === 0;
}

/**
 * Check if array has elements (length > 0).
 * Also handles null/undefined arrays safely.
 * @example
 * if (hasElements(players)) { startGame(); }
 */
export function hasElements<T>(arr: T[] | null | undefined): arr is T[] {
    return arr !== null && arr !== undefined && arr.length > 0;
}

/**
 * Check if string is empty, null, or undefined.
 * @example
 * if (isBlank(data)) { throw new Error("Data required"); }
 */
export function isBlank(value: string | null | undefined): boolean {
    return value === null || value === undefined || value === "";
}

/**
 * Check if string has content (not empty, null, or undefined).
 * @example
 * if (hasContent(data)) { parse(data); }
 */
export function hasContent(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== "";
}
