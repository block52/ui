import React from "react";
import "./MultiTable.css";
import { TablePill } from "./TablePill";
import { MAX_OPEN_TABLES, OpenTable, TableStatus } from "../../context/tableSessions/sessionsModel";
import { isEmpty } from "../../utils/guards";

/**
 * The multi-tabling pill bar (block52/ui#55). A horizontal strip of table pills with
 * a trailing "+" to open another table (up to {@link MAX_OPEN_TABLES}). Presentational
 * only — it is handed the open tables, live status, and callbacks, so it can be unit
 * tested and previewed without the live game providers.
 */
export interface TablePillBarProps {
    openTables: OpenTable[];
    activeId: string | null;
    statusById: Record<string, TableStatus>;
    canOpenMore: boolean;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onAddTable: () => void;
}

export const TablePillBar: React.FC<TablePillBarProps> = ({
    openTables,
    activeId,
    statusById,
    canOpenMore,
    onSelect,
    onClose,
    onAddTable
}) => {
    if (isEmpty(openTables)) return null;

    return (
        <div
            role="tablist"
            aria-label="Open tables"
            className="b52-pill-bar flex items-center gap-2 overflow-x-auto px-3 py-2"
        >
            {openTables.map(t => (
                <TablePill
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    status={statusById[t.id]}
                    isActive={t.id === activeId}
                    onSelect={onSelect}
                    onClose={onClose}
                />
            ))}

            <button
                type="button"
                aria-label="Open another table"
                title={canOpenMore ? "Open another table" : `Up to ${MAX_OPEN_TABLES} tables`}
                onClick={onAddTable}
                disabled={!canOpenMore}
                className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-lg font-bold transition-all duration-200",
                    canOpenMore
                        ? "border-slate-600/60 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70 hover:text-white"
                        : "cursor-not-allowed border-slate-700/40 bg-slate-800/40 text-slate-600"
                ].join(" ")}
            >
                +
            </button>
        </div>
    );
};
