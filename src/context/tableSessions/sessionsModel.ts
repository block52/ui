/**
 * Multi-tabling session model (block52/ui#55) — the pure state + reducer behind the
 * table pill bar. Keeps the list of open tables (max 4), which one is active, and a
 * per-table live status (is it your turn, your hole cards) that the pills render.
 *
 * Kept free of React so it can be unit-tested on its own. The provider in
 * TableSessionsContext.tsx wraps this with persistence and the live status feed.
 */

/** The most tables a player may have open at once. */
export const MAX_OPEN_TABLES = 4;

/**
 * Where a floating table bubble sits (ui#887): its centre as a fraction of the
 * viewport (0–1 on each axis), so it stays in place proportionally on resize.
 */
export interface BubblePosition {
    x: number;
    y: number;
}

/** One open table. `name` is best-effort (filled once its state loads). */
export interface OpenTable {
    id: string;
    name?: string;
    /**
     * Set when the table has been pulled out of the header into a floating
     * bubble (ui#887); absent while it is a pill in the header bar.
     */
    bubble?: BubblePosition;
}

/** The live, per-table snapshot the pill renders (reported by each live table). */
export interface TableStatus {
    /** Whether it is the player's turn to act at this table — drives the glowing ring. */
    isMyTurn: boolean;
    /** The player's two hole cards at this table, e.g. ["AS","KH"]; empty if none/hidden. */
    holeCards: string[];
    /** The table's display name once known. */
    name?: string;
}

export interface SessionsState {
    openTables: OpenTable[];
    activeId: string | null;
    /** Live status per open table id; absent until the table first reports. */
    statusById: Record<string, TableStatus>;
}

export type SessionsAction =
    | { type: "OPEN"; id: string; name?: string }
    | { type: "CLOSE"; id: string }
    | { type: "SET_ACTIVE"; id: string }
    | { type: "MOVE"; id: string; toIndex: number }
    | { type: "FLOAT"; id: string; position: BubblePosition }
    | { type: "DOCK"; id: string; toIndex: number }
    | { type: "REPORT"; id: string; status: TableStatus }
    | { type: "HYDRATE"; openTables: OpenTable[]; activeId: string | null };

export const emptySessions: SessionsState = { openTables: [], activeId: null, statusById: {} };

const has = (tables: OpenTable[], id: string): boolean => tables.some(t => t.id === id);

export function sessionsReducer(state: SessionsState, action: SessionsAction): SessionsState {
    switch (action.type) {
        case "OPEN": {
            // Re-opening an already-open table just focuses it; never duplicates.
            if (has(state.openTables, action.id)) {
                return { ...state, activeId: action.id };
            }
            // Silently ignore opens past the cap — the UI disables + at the limit.
            if (state.openTables.length >= MAX_OPEN_TABLES) {
                return state;
            }
            const openTables = [...state.openTables, { id: action.id, name: action.name }];
            return { ...state, openTables, activeId: action.id };
        }
        case "CLOSE": {
            if (!has(state.openTables, action.id)) return state;
            let openTables = state.openTables.filter(t => t.id !== action.id);
            // A lone table has no pill bar to dock into, so it can't stay a bubble (ui#887).
            if (openTables.length === 1 && openTables[0].bubble) {
                openTables = [{ id: openTables[0].id, name: openTables[0].name }];
            }
            // Drop the closed table's status so it can't leak into a later reopen.
            const statusById = { ...state.statusById };
            delete statusById[action.id];
            // If the active table was closed, fall back to the last remaining one.
            const activeId =
                state.activeId === action.id ? (openTables.length ? openTables[openTables.length - 1].id : null) : state.activeId;
            return { openTables, activeId, statusById };
        }
        case "SET_ACTIVE": {
            // Only focus a table that is actually open.
            return has(state.openTables, action.id) ? { ...state, activeId: action.id } : state;
        }
        case "MOVE": {
            // Drag-to-reorder in the pill bar. `toIndex` is a position among the
            // header pills (tables not floated as bubbles).
            const table = state.openTables.find(t => t.id === action.id);
            if (!table || table.bubble) return state;
            const openTables = placeAmongPills(state.openTables, table, action.toIndex);
            return openTables === state.openTables ? state : { ...state, openTables };
        }
        case "FLOAT": {
            // Pull a table out of the header into a floating bubble, or move a bubble.
            if (!has(state.openTables, action.id)) return state;
            const position = clampBubble(action.position);
            const openTables = state.openTables.map(t => (t.id === action.id ? { ...t, bubble: position } : t));
            return { ...state, openTables };
        }
        case "DOCK": {
            // Drop a bubble back into the header bar as a pill at `toIndex`.
            const table = state.openTables.find(t => t.id === action.id);
            if (!table) return state;
            const docked: OpenTable = { id: table.id, name: table.name };
            const openTables = placeAmongPills(state.openTables, docked, action.toIndex, true);
            return { ...state, openTables };
        }
        case "REPORT": {
            // Ignore reports for tables that aren't open (a torn-down table in flight).
            if (!has(state.openTables, action.id)) return state;
            // Keep a name we already have if the report omits it.
            const prev = state.statusById[action.id];
            const name = action.status.name ?? prev?.name;
            const statusById = { ...state.statusById, [action.id]: { ...action.status, name } };
            // Mirror a learned name onto the openTables entry so it survives a reload.
            const openTables = name
                ? state.openTables.map(t => (t.id === action.id && t.name !== name ? { ...t, name } : t))
                : state.openTables;
            return { ...state, statusById, openTables };
        }
        case "HYDRATE": {
            // Restore persisted tables, trimmed to the cap; status always starts empty
            // (it is live and will be re-reported as each table reconnects).
            const openTables = action.openTables.slice(0, MAX_OPEN_TABLES);
            const activeId = openTables.some(t => t.id === action.activeId) ? action.activeId : (openTables[0]?.id ?? null);
            return { openTables, activeId, statusById: {} };
        }
        default:
            return state;
    }
}

/** Keep a bubble's centre inside the viewport (as 0–1 fractions). */
export const clampBubble = (p: BubblePosition): BubblePosition => ({
    x: Math.min(1, Math.max(0, Number.isFinite(p.x) ? p.x : 0.5)),
    y: Math.min(1, Math.max(0, Number.isFinite(p.y) ? p.y : 0.5))
});

/** The tables shown as pills in the header, in order. */
export const dockedTables = (tables: OpenTable[]): OpenTable[] => tables.filter(t => !t.bubble);

/** The tables floated out as bubbles. */
export const floatingTables = (tables: OpenTable[]): OpenTable[] => tables.filter(t => !!t.bubble);

/**
 * Put `table` at position `toIndex` among the header pills; bubbles keep their
 * relative order after the pills. Returns the same array when nothing changes.
 * `replace` swaps in the given object even if the order is unchanged (docking).
 */
function placeAmongPills(tables: OpenTable[], table: OpenTable, toIndex: number, replace = false): OpenTable[] {
    const pills = dockedTables(tables).filter(t => t.id !== table.id);
    const bubbles = floatingTables(tables).filter(t => t.id !== table.id);
    const to = Math.max(0, Math.min(pills.length, Math.trunc(toIndex)));
    const nextPills = [...pills.slice(0, to), table, ...pills.slice(to)];
    const next = [...nextPills, ...bubbles];
    const unchanged = !replace && next.every((t, i) => t.id === tables[i]?.id) && next.length === tables.length;
    return unchanged ? tables : next;
}

/** Whether another table can still be opened. */
export const canOpenMore = (state: SessionsState): boolean => state.openTables.length < MAX_OPEN_TABLES;
