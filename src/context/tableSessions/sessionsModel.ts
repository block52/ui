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

/** One open table in the bar. `name` is best-effort (filled once its state loads). */
export interface OpenTable {
    id: string;
    name?: string;
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
            const openTables = state.openTables.filter(t => t.id !== action.id);
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
            // Drag-to-reorder in the pill bar: move a table to a new position.
            const from = state.openTables.findIndex(t => t.id === action.id);
            if (from < 0) return state;
            const to = Math.max(0, Math.min(state.openTables.length - 1, Math.trunc(action.toIndex)));
            if (to === from) return state;
            const openTables = [...state.openTables];
            const [moved] = openTables.splice(from, 1);
            openTables.splice(to, 0, moved);
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

/** Whether another table can still be opened. */
export const canOpenMore = (state: SessionsState): boolean => state.openTables.length < MAX_OPEN_TABLES;
