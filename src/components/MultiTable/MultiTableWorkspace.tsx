import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./MultiTable.css";
import { GameStateProvider } from "../../context/GameStateContext";
import { ActionSubmitProvider } from "../../context/ActionSubmitContext";
import Table from "../playPage/Table";
import { TableStatusReporter } from "./TableStatusReporter";
import { TablePillBar } from "./TablePillBar";
import { MultiTablePicker } from "./MultiTablePicker";
import { TableSessionsProvider, useTableSessions } from "../../context/tableSessions/TableSessionsContext";
import type { OpenTable } from "../../context/tableSessions/sessionsModel";
import { TableHeaderSlotProvider } from "../../context/TableHeaderSlotContext";
import { TableIdProvider } from "../../context/TableIdContext";
import { isEmpty } from "../../utils/guards";

/**
 * Multi-tabling workspace (block52/ui#55, PR 2).
 *
 * Renders the pill bar plus every open table, each in its OWN
 * GameStateProvider (one socket + one isolated state tree per table) and its
 * OWN ActionSubmitProvider, so each table's connection, hooks and action panel
 * read that table's state. Only the active table is visible; the others are
 * kept mounted behind `display:none` so their sockets and bus state stay live
 * and the pills keep updating (turn glow, hole cards) in the background.
 *
 * Single-table behaviour is preserved: when exactly one table is open the only
 * added chrome is a small "+ Table" button; the table itself renders exactly as
 * the plain /table/:id route did, through the same provider structure.
 *
 * NOTE (known limitation, see PR description): the outbound submission path
 * (ActionSubmitController) reads the logical-track snapshot from a module-level
 * singleton (hooks/playerActions/transportAction), which every mounted table's
 * bus writes to. With more than one table live, background tables' frames and
 * auto-action hooks share that singleton, so concurrent cross-table submission
 * is not yet isolated. Making the logical track per-table (and pausing
 * auto-actions on background tables) is the follow-up before this leaves draft.
 */
export const MultiTableWorkspace: React.FC = () => {
    const { id: routeId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { openTables, activeId, statusById, canOpenMore, openTable, closeTable, setActive, moveTable } = useTableSessions();
    const [pickerOpen, setPickerOpen] = useState(false);

    // Seed the route's table id as the active session, once per route id (the
    // first route id is already seeded in the provider's initial state; this
    // covers later in-app navigations to another /table/:id). The
    // sessions actions are dispatch wrappers whose identity changes on every
    // state update, so we deliberately key this on the route id alone and guard
    // with a ref — re-seeding on every status report would steal focus back.
    const seededRef = useRef<string | null>(null);
    useEffect(() => {
        if (routeId && seededRef.current !== routeId) {
            seededRef.current = routeId;
            openTable(routeId);
            setActive(routeId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeId]);

    // Keep the URL in sync with the active table. Navigating to the same route
    // path only changes the :id param, so React keeps this workspace — and every
    // mounted table — in place rather than unmounting them.
    useEffect(() => {
        if (activeId && activeId !== routeId) {
            navigate(`/table/${activeId}`, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    const handleSelect = useCallback((id: string) => setActive(id), [setActive]);
    const handleClose = useCallback((id: string) => closeTable(id), [closeTable]);
    const handleReorder = useCallback((id: string, toIndex: number) => moveTable(id, toIndex), [moveTable]);
    const handlePick = useCallback(
        (id: string, name?: string) => {
            openTable(id, name);
            setActive(id);
            setPickerOpen(false);
        },
        [openTable, setActive]
    );

    // Render from the store, but fall back to the route id on the very first
    // render (before the seeding effect has run) so the active table paints
    // immediately with no blank frame — identical to the old single-table route.
    const effectiveTables = useMemo<OpenTable[]>(
        () => (openTables.length ? openTables : routeId ? [{ id: routeId }] : []),
        [openTables, routeId]
    );
    const effectiveActiveId = activeId ?? routeId ?? null;

    if (isEmpty(effectiveTables)) {
        return null;
    }

    const isMulti = effectiveTables.length > 1;

    // The pill bar (or, with one table, a compact "+ Table") goes into the ACTIVE
    // table's header via the header slot — in the sub-header row on desktop, its
    // own slim row on phones — so it never floats over header controls.
    const headerControls = isMulti ? (
        <TablePillBar
            openTables={openTables}
            activeId={activeId}
            statusById={statusById}
            canOpenMore={canOpenMore}
            onSelect={handleSelect}
            onClose={handleClose}
            onAddTable={() => setPickerOpen(true)}
            onReorder={handleReorder}
        />
    ) : (
        <button
            type="button"
            className="b52-mt-add"
            onClick={() => setPickerOpen(true)}
            title="Open another table"
            aria-label="Open another table"
        >
            + Table
        </button>
    );

    return (
        <>
            {effectiveTables.map(t => {
                const isActive = t.id === effectiveActiveId;
                return (
                    // display:none keeps the table mounted (socket + state alive) while
                    // hidden; the active table uses display:contents so the wrapper adds
                    // no box and Table's own full-screen layout is unchanged.
                    <div
                        key={t.id}
                        style={{ display: isActive ? "contents" : "none" }}
                        data-testid={`multitable-slot-${t.id}`}
                        data-active={isActive}
                    >
                        <TableIdProvider value={t.id}>
                            <TableHeaderSlotProvider value={isActive ? headerControls : null}>
                                <GameStateProvider>
                                    <ActionSubmitProvider>
                                        <TableStatusReporter tableId={t.id} />
                                        <Table tableId={t.id} />
                                    </ActionSubmitProvider>
                                </GameStateProvider>
                            </TableHeaderSlotProvider>
                        </TableIdProvider>
                    </div>
                );
            })}

            {pickerOpen && (
                <MultiTablePicker
                    openIds={effectiveTables.map(t => t.id)}
                    onPick={handlePick}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </>
    );
};

/**
 * The /table/:id route element: the sessions provider seeded with the route's
 * table id (so a deep link opens that table, not the persisted active one),
 * wrapping the workspace.
 */
export const MultiTableRoute: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return (
        <TableSessionsProvider initialActiveId={id}>
            <MultiTableWorkspace />
        </TableSessionsProvider>
    );
};

export default MultiTableRoute;
