import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
    sessionsReducer,
    emptySessions,
    canOpenMore,
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
            .map((t: OpenTable) => ({ id: t.id, name: typeof t.name === "string" ? t.name : undefined }));
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
    /** Live tables call this to push their turn/hole-card status up to the pills. */
    reportStatus: (id: string, status: TableStatus) => void;
}

const TableSessionsContext = createContext<TableSessionsContextValue | null>(null);

export const TableSessionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(sessionsReducer, emptySessions, (initial): SessionsState => {
        const persisted = loadPersisted();
        return persisted ? sessionsReducer(initial, { type: "HYDRATE", ...persisted }) : initial;
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
