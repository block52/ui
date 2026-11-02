import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";

/**
 * Which table this subtree belongs to (ui#834).
 *
 * Table components used to read the id from the /table/:id route. With several
 * tables mounted (multi-tabling, ui#55) the route names only the ACTIVE table,
 * so a hidden table's action panel, seats and log would act on — and submit to —
 * the visible one. The multi-table workspace provides each table's own id here;
 * outside it (or with no provider) this falls back to the route id, as before.
 */
const TableIdContext = createContext<string | undefined>(undefined);

export const TableIdProvider = TableIdContext.Provider;

export const useTableId = (): string | undefined => {
    const provided = useContext(TableIdContext);
    const { id: routeId } = useParams<{ id: string }>();
    return provided ?? routeId;
};
