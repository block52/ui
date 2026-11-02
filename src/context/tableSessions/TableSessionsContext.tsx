import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
    sessionsReducer,
    emptySessions,
    canOpenMore,
    clampBubble,
    BubblePosition,
    OpenTable,
    SessionsState,
    TableStatus
} from "./sessionsModel";

/**
 * Multi-tabling provider (block52/ui#55). Owns the list of open tables, the active
 * one, and each table's live status (reported by the live table instances in the
 * workspace). Persists the open tables + active id to localStorage so a reload
 * reopens the same set. The live status is deliberately NOT persisted — it is
 * re-reported as each table reconnects.
 */
const STORAGE_KEY = "b52.multitable.v1";

interface Persisted {
    openTables: OpenTable[];
    activeId: string | null;
}

function loadPersisted(): Persisted | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.openTables)) return null;
        const openTables: OpenTable[] = parsed.openTables
            .filter((t: unknown): t is OpenTable => !!t && typeof (t as OpenTable).id === "string")
            .map((t: OpenTable) => ({
                id: t.id,
                name: typeof t.name === "string" ? t.name : undefined,
                bubble:
                    t.bubble && typeof t.bubble.x === "number" && typeof t.bubble.y === "number"
                        ? clampBubble(t.bubble)
                        : undefined
            }));
        const activeId = typeof parsed.activeId === "string" ? parsed.activeId : null;
        return { openTables, activeId };
    } catch {
        return null;
    }
}

export interface TableSessionsContextValue {
    openTables: OpenTable[];
    activeId: string | null;
    statusById: Record<string, TableStatus>;
    canOpenMore: boolean;
    openTable: (id: string, name?: string) => void;
    closeTable: (id: string) => void;
    setActive: (id: string) => void;
    /** Move a table to a new position in the pill bar (drag-to-reorder). */
    moveTable: (id: string, toIndex: number) => void;
    /** Float a table out of the header as a bubble at `position`, or move its bubble (ui#887). */
    floatTable: (id: string, position: BubblePosition) => void;
    /** Dock a bubble back into the header as a pill at `toIndex` (ui#887). */
    dockTable: (id: string, toIndex: number) => void;
    /** Live tables call this to push their turn/hole-card status up to the pills. */
    reportStatus: (id: string, status: TableStatus) => void;
}

const TableSessionsContext = createContext<TableSessionsContextValue | null>(null);

interface TableSessionsProviderProps {
    children: React.ReactNode;
    /**
     * The table the user navigated to (the /table/:id route param). It is opened
     * and made active in the INITIAL state, on top of whatever was persisted, so
     * a deep link wins over the stored active table from the first render. If it
     * were seeded later (in an effect), the URL-sync effect would first see the
     * stale persisted active id and redirect the link back to it.
     */
    initialActiveId?: string;
}

export const TableSessionsProvider: React.FC<TableSessionsProviderProps> = ({ children, initialActiveId }) => {
    const [state, dispatch] = useReducer(sessionsReducer, emptySessions, (initial): SessionsState => {
        const persisted = loadPersisted();
        const hydrated = persisted ? sessionsReducer(initial, { type: "HYDRATE", ...persisted }) : initial;
        return initialActiveId ? sessionsReducer(hydrated, { type: "OPEN", id: initialActiveId }) : hydrated;
    });

    // Persist only the durable slice (tables + active), never the live status.
    const lastSaved = useRef<string>("");
    useEffect(() => {
        try {
            const payload = JSON.stringify({ openTables: state.openTables, activeId: state.activeId });
            if (payload !== lastSaved.current) {
                localStorage.setItem(STORAGE_KEY, payload);
                lastSaved.current = payload;
            }
        } catch {
            // Private mode / blocked storage — multi-tabling still works in-session.
        }
    }, [state.openTables, state.activeId]);

    const value = useMemo<TableSessionsContextValue>(
        () => ({
            openTables: state.openTables,
            activeId: state.activeId,
            statusById: state.statusById,
            canOpenMore: canOpenMore(state),
            openTable: (id, name) => dispatch({ type: "OPEN", id, name }),
            closeTable: id => dispatch({ type: "CLOSE", id }),
            setActive: id => dispatch({ type: "SET_ACTIVE", id }),
            moveTable: (id, toIndex) => dispatch({ type: "MOVE", id, toIndex }),
            floatTable: (id, position) => dispatch({ type: "FLOAT", id, position }),
            dockTable: (id, toIndex) => dispatch({ type: "DOCK", id, toIndex }),
            reportStatus: (id, status) => dispatch({ type: "REPORT", id, status })
        }),
        [state]
    );

    return <TableSessionsContext.Provider value={value}>{children}</TableSessionsContext.Provider>;
};

export const useTableSessions = (): TableSessionsContextValue => {
    const ctx = useContext(TableSessionsContext);
    if (!ctx) throw new Error("useTableSessions must be used within a TableSessionsProvider");
    return ctx;
};
