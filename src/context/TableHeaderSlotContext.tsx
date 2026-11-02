import React, { createContext, useContext } from "react";

/**
 * Extra controls a host page puts into the table header (ui#55): the
 * multi-tabling workspace uses it for the table pill bar / "+ Table" button.
 * The desktop header renders it in the sub-header row (between the hand info
 * and Leave Table); the mobile header gives it its own slim row.
 *
 * A context rather than a Table prop so a pill update re-renders only the
 * header, not the whole (memoised) table.
 */
const TableHeaderSlotContext = createContext<React.ReactNode>(null);

export const TableHeaderSlotProvider = TableHeaderSlotContext.Provider;

export const useTableHeaderSlot = (): React.ReactNode => useContext(TableHeaderSlotContext);
