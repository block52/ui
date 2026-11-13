import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTournament } from "../hooks/tournament/useTournament";
import { hasValue } from "../utils/guards";
import { tournamentUrl } from "../utils/tableUrl";
import { isTournamentTableLive } from "../utils/tournamentTables";

/**
 * `/tournament/:tournamentId/table/:n`. A table that has been broken up (or never
 * existed) has no state to show, so its URL, an old link or a stale tab used to
 * end in "WebSocket server not responding". The tournament knows its live tables:
 * when this one is not among them, go to the tournament's page, which takes a
 * seated player to the table they are at now and shows everyone else the standings.
 * While the tournament record loads, the table renders as usual.
 */
export default function TournamentTableRoute({ children }: { children: ReactNode }) {
    const { tournamentId, n } = useParams<{ tournamentId: string; n: string }>();
    const { tournament } = useTournament(tournamentId);

    if (hasValue(tournamentId) && hasValue(n) && hasValue(tournament) && tournament.status !== "registering" && !isTournamentTableLive(tournament, Number(n))) {
        return <Navigate to={tournamentUrl(tournamentId)} replace />;
    }
    return <>{children}</>;
}
