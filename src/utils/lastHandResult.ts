/**
 * Module-level store for the previous hand's showdown summary (stop-gap for
 * fast showdowns).
 *
 * The History sidebar UNMOUNTS while closed (its off-canvas content was an a11y
 * leak — see TableSidebar), and the chain snapshot drops winners/actions the
 * moment the next hand deals — so by the time a player who missed a fast
 * showdown opens History, neither component state nor the snapshot can say what
 * happened. This store is written by an always-mounted capture hook while the
 * END round is live and survives the sidebar's mount cycle.
 *
 * Framework-free plain TS (React coupling stays in the hooks layer);
 * useSyncExternalStore-compatible subscribe/get pair.
 */

export interface LastHandResult {
    tableId: string;
    handNumber: number;
    lines: string[];
}

let current: LastHandResult | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
    listeners.forEach(listener => listener());
};

export const getLastHandResult = (): LastHandResult | null => current;

/**
 * Store a hand's summary. Identical re-captures (the capture effect runs on
 * every WS frame during the END hold) are dropped without notifying, so the
 * snapshot identity stays stable for useSyncExternalStore.
 */
export const setLastHandResult = (next: LastHandResult): void => {
    if (
        current &&
        current.tableId === next.tableId &&
        current.handNumber === next.handNumber &&
        current.lines.join("\n") === next.lines.join("\n")
    ) {
        return;
    }
    current = next;
    notify();
};

export const subscribeLastHandResult = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Test/table-change helper: clears the retained result. */
export const resetLastHandResult = (): void => {
    if (current === null) return;
    current = null;
    notify();
};
