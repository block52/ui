import { useEffect, useMemo, useState } from "react";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { getCosmosAddressSync } from "../../utils/cosmosAccountUtils";
import { parseTournamentState } from "../../utils/tournamentBlinds";
import { tournamentProgress, type MyTournamentTable } from "../../utils/tournamentFollow";
import type { TournamentStateDTO } from "../../types/tournament";

/** How often a live tournament is re-read. */
export const TOURNAMENT_POLL_MS = 4000;

export interface TournamentInfo {
    /** The chain's tournament record; undefined until the first read succeeds (or no id given). */
    tournament: TournamentStateDTO | undefined;
    isLoading: boolean;
    /** The last read failed; the previous record (if any) is kept. */
    error: Error | null;
    /** Entrants still playing; undefined until loaded. */
    playersRemaining: number | undefined;
    /** Where the connected wallet plays (game id, table N of M); undefined when it is not playing. */
    myTable: MyTournamentTable | undefined;
    /** The tournament's blind level (0-based); undefined until loaded. */
    level: number | undefined;
}

const isSettled = (t: TournamentStateDTO | undefined): boolean => t?.status === "finished" || t?.status === "cancelled";

/**
 * Reads a multi-table tournament from the chain and keeps it fresh (polls every
 * few seconds, and stops once it is finished or cancelled). Pass undefined for a
 * table that is not part of a tournament: nothing is fetched.
 */
export const useTournament = (tournamentId: string | undefined): TournamentInfo => {
    const api = useCosmosApi();
    const [tournament, setTournament] = useState<TournamentStateDTO | undefined>(undefined);
    const [error, setError] = useState<Error | null>(null);
    const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);

    const settled = isSettled(tournament);

    useEffect(() => {
        if (!tournamentId || settled) return;
        let cancelled = false;

        const read = async () => {
            try {
                const res = await api.getTournament(tournamentId);
                if (cancelled) return;
                setTournament(parseTournamentState(res.tournament));
                setLoadedFor(tournamentId);
                setError(null);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        };

        read();
        const interval = setInterval(read, TOURNAMENT_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [api, tournamentId, settled]);

    // A record read for another tournament must not be shown for this one.
    const current = tournament && tournament.tournamentId === tournamentId ? tournament : undefined;

    const progress = useMemo(() => (current ? tournamentProgress(current, getCosmosAddressSync() ?? undefined) : undefined), [current]);

    return {
        tournament: current,
        isLoading: !!tournamentId && loadedFor !== tournamentId && error === null,
        error,
        playersRemaining: progress?.playersRemaining,
        myTable: progress?.myTable,
        level: current?.level
    };
};
