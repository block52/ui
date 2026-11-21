import { useCallback, useEffect, useRef, useState } from "react";
import { httpErrorMessage } from "../../apis/HTTPClient";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { hasContent, hasValue } from "../../utils/guards";
import { mapWithConcurrency } from "../../utils/pagedFetch";
import { isPrizeClaimAddress } from "../../utils/playerPrizeClaims";
import {
    earliestRegistrations,
    readTournamentRecord,
    tournamentEntryFromRegistration,
    tournamentRegisteredQuery,
    tournamentRegistrationsFromTxSearch,
    tournamentUnregisteredQuery,
    tournamentUnregistrationsFromTxSearch,
    withTournamentRefunds,
    type PlayerTournamentEntry,
    type TournamentRegistration,
    type TournamentUnregistration
} from "../../utils/playerTournamentEntries";

export interface SilentRefetchOptions {
    /** Keep the current rows on screen; do not flip the hook back to loading. */
    silent?: boolean;
}

interface UsePlayerTournamentEntriesResult {
    entries: PlayerTournamentEntry[];
    registrations: TournamentRegistration[];
    unregistrations: TournamentUnregistration[];
    loading: boolean;
    /** Set when the registration query failed. Entries stay empty so the indexer rows still show. */
    error: string | null;
    refetch: (options?: SilentRefetchOptions) => void;
}

interface EntryState {
    address: string;
    entries: PlayerTournamentEntry[];
    registrations: TournamentRegistration[];
    unregistrations: TournamentUnregistration[];
    error: string | null;
}

const EMPTY_ENTRIES: PlayerTournamentEntry[] = [];
const EMPTY_REGISTRATIONS: TournamentRegistration[] = [];
const EMPTY_UNREGISTRATIONS: TournamentUnregistration[] = [];

/**
 * Multi-table tournaments one player registered for, from the configured node.
 *
 * `tournament_registered.player='<addr>'` on the node's transaction search
 * (the REST GetTxsEvent the rest of the profile uses) gives the tournament id,
 * the register height, and the buy-in plus entry fee. Each id is then read
 * with `getTournament`. Unregister refunds come from a parallel
 * `tournament_unregistered` query. A failed registration query leaves the
 * list empty; a failed unregister query keeps the entries and omits refunds.
 */
export function usePlayerTournamentEntries(address: string | undefined): UsePlayerTournamentEntriesResult {
    const cosmosApi = useCosmosApi();
    const [state, setState] = useState<EntryState | null>(null);
    const [loading, setLoading] = useState<boolean>(hasContent(address));
    const player = hasContent(address) ? address.toLowerCase() : undefined;
    const requestId = useRef(0);

    const fetchEntries = useCallback(
        async (options?: SilentRefetchOptions) => {
            const id = ++requestId.current;
            if (!hasContent(player)) {
                setState(null);
                setLoading(false);
                return;
            }
            if (!isPrizeClaimAddress(player)) {
                setState({ address: player, entries: [], registrations: [], unregistrations: [], error: "Invalid player address" });
                setLoading(false);
                return;
            }
            const silent = options?.silent === true;
            if (!silent) setLoading(true);
            try {
                const [regResponse, unregResponse] = await Promise.all([
                    cosmosApi.getAllTransactionsMatching(tournamentRegisteredQuery(player)),
                    cosmosApi.getAllTransactionsMatching(tournamentUnregisteredQuery(player)).catch(err => {
                        console.error("Failed to fetch tournament unregistrations:", err);
                        return null;
                    })
                ]);
                const registrations = tournamentRegistrationsFromTxSearch(regResponse, player);
                const unregistrations = hasValue(unregResponse) ? tournamentUnregistrationsFromTxSearch(unregResponse, player) : [];
                const loaded = await mapWithConcurrency(earliestRegistrations(registrations), 4, async registration => {
                    try {
                        const record = readTournamentRecord(await cosmosApi.getTournament(registration.tournamentId));
                        if (!hasValue(record)) return undefined;
                        return tournamentEntryFromRegistration(registration, record, player);
                    } catch (err) {
                        console.error("Failed to read tournament:", err);
                        return undefined;
                    }
                });
                if (id !== requestId.current) return;
                setState({
                    address: player,
                    entries: withTournamentRefunds(loaded.filter(hasValue), unregistrations),
                    registrations,
                    unregistrations,
                    error: null
                });
            } catch (err) {
                if (id !== requestId.current) return;
                console.error("Failed to fetch tournament entries:", err);
                setState(current => {
                    if (silent && hasValue(current) && current.address === player) {
                        return { ...current, error: httpErrorMessage(err, "Failed to fetch tournament entries") };
                    }
                    return { address: player, entries: [], registrations: [], unregistrations: [], error: httpErrorMessage(err, "Failed to fetch tournament entries") };
                });
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        },
        [cosmosApi, player]
    );

    useEffect(() => {
        void fetchEntries();
        return () => {
            requestId.current += 1;
        };
    }, [fetchEntries]);

    const ready = hasValue(state) && state.address === player;
    return {
        entries: ready ? state.entries : EMPTY_ENTRIES,
        registrations: ready ? state.registrations : EMPTY_REGISTRATIONS,
        unregistrations: ready ? state.unregistrations : EMPTY_UNREGISTRATIONS,
        loading: hasContent(player) && (!ready || loading),
        error: ready ? state.error : null,
        refetch: fetchEntries
    };
}
