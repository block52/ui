/**
 * Count list items by their `status` in a single pass (ui#707).
 *
 * Replaces one `.filter(...).length` per status on the admin dashboards.
 * Statuses with no items are absent from the result, so read with `?? 0`.
 *
 * Pure.
 */
export function countByStatus<S extends string>(items: ReadonlyArray<{ status: S }>): Partial<Record<S, number>> {
    const counts: Partial<Record<S, number>> = {};
    for (const item of items) {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
}
