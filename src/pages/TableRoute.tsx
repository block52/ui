import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { parseTournamentGameId, tableUrl } from "../utils/tableUrl";

/**
 * `/table/:id`. A tournament table's game id (`<tournamentId>-t<n>`) belongs at
 * `/tournament/<tournamentId>/table/<n>`, so an old link, the explorer or a copied
 * URL is redirected there (query string kept: `?hand=` replays). Any other game
 * is shown as before.
 */
export default function TableRoute({ children }: { children: ReactNode }) {
    const { id } = useParams<{ id: string }>();
    const { search } = useLocation();
    if (id && parseTournamentGameId(id)) {
        return <Navigate to={`${tableUrl(id)}${search}`} replace />;
    }
    return <>{children}</>;
}
