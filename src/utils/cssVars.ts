import type { CSSProperties } from "react";

/**
 * Build a React `style` object from CSS custom properties (`--name: value`).
 *
 * React's `CSSProperties` type has no index signature for custom properties, so
 * every call site would otherwise need its own inline cast (Commandment 12: one
 * centralized, tested conversion instead). Values pass through untouched — the
 * caller supplies units (`"200ms"`, `"12px"`).
 *
 * @param vars custom properties, keys starting with `--`.
 * @returns the same map typed as a React style object.
 */
export function cssVars(vars: Readonly<Record<string, string>>): CSSProperties {
    for (const key of Object.keys(vars)) {
        if (!key.startsWith("--")) {
            throw new Error(`cssVars: "${key}" is not a CSS custom property (expected a "--" prefix)`);
        }
    }
    return vars as unknown as CSSProperties;
}
