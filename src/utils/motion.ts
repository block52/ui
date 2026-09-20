/**
 * Does the viewer's OS/browser ask for reduced motion?
 *
 * Mirrors the `@media (prefers-reduced-motion: reduce)` blocks in Table.css so
 * hooks that schedule choreography (and ack the bus when it finishes) can skip
 * it in JS the same way the stylesheet skips it in CSS. Safe under jsdom, which
 * has no `matchMedia`: reports `false`.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
