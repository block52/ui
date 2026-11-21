import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CosmosApi, IndexerApi } from "../../apis/Api";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerListItem, PlayerSearchParams, PlayerSession, PlayerSortField } from "../../types/players";
import type { TournamentStateDTO } from "../../types/tournament";
import { hasContent, hasElements, hasValue, isNumber } from "../../utils/guards";
import { fetchAllPages, mapWithConcurrency } from "../../utils/pagedFetch";
import { playersPage } from "../../utils/playerDirectory";
import {
    ALL_PRIZE_CLAIMS_QUERY,
    PRIZE_DIRECTORY_QUERY_TIMEOUT_MS,
    isPrizeClaimAddress,
    isUnsupportedTxQuery,
    prizeClaimsByPlayer,
    prizeClaimsFromTxSearch,
    prizeClaimsQueryFor,
    type PlayerPrizeClaim
} from "../../utils/playerPrizeClaims";
import { playerListWithAllVariants } from "../../utils/profileStatsMoney";
import {
    ALL_TOURNAMENT_REGISTERED_QUERY,
    ALL_TOURNAMENT_UNREGISTERED_QUERY,
    readTournamentRecord,
    tournamentEntriesByPlayer,
    tournamentRegisteredQuery,
    tournamentRegistrationsByPlayer,
    tournamentUnregisteredQuery,
    tournamentUnregistrationsByPlayer,
    uniqueTournamentIds,
    type PlayerTournamentEntry,
    type TournamentRegistration,
    type TournamentUnregistration
} from "../../utils/playerTournamentEntries";

/** Session reads and per-player chain queries in flight at once. */
const DIRECTORY_FETCH_CONCURRENCY = 6;

interface TournamentDirectory {
    registrationsByPlayer: Map<string, TournamentRegistration[]>;
    unregistrationsByPlayer: Map<string, TournamentUnregistration[]>;
    entriesByPlayer: Map<string, PlayerTournamentEntry[]>;
}

interface LoadedDirectory {
    search: string;
    reloadKey: number;
    raw: PlayerListItem[];
    /**
     * global: `listed` is every row with prizes and MTT money applied, so net
     * sort is correct across the whole directory.
     * indexer: the prize-claim query failed; `listed` is the raw indexer directory.
     * perPlayer: the node rejected a global event query. Only the visible
     * page is corrected, then re-sorted within that page.
     */
    mode: "global" | "indexer" | "perPlayer";
    listed: PlayerListItem[];
}

interface PerPlayerView {
    search: string;
    reloadKey: number;
    sort: PlayerSortField | undefined;
    order: "asc" | "desc" | undefined;
    limit: number | undefined;
    offset: number | undefined;
    players: PlayerListItem[];
}

type GlobalClaims = Map<string, PlayerPrizeClaim[]> | "unsupported" | "failed";
type GlobalTournaments = TournamentDirectory | "unsupported" | "failed";

export interface SilentRefetchOptions {
    /** Keep the current rows on screen; do not flip the hook back to loading. */
    silent?: boolean;
}

interface UsePlayersDirectoryResult {
    players: PlayerListItem[];
    total: number;
    loading: boolean;
    error: string | null;
    refetch: (options?: SilentRefetchOptions) => void;
}

let globalClaims: Map<string, PlayerPrizeClaim[]> | undefined;
let globalClaimsInflight: Promise<GlobalClaims> | null = null;
let globalUnsupported = false;
let globalTournaments: TournamentDirectory | undefined;
let globalTournamentsInflight: Promise<GlobalTournaments> | null = null;
let globalTournamentsUnsupported = false;
const sessionCache = new Map<string, PlayerSession[]>();
const sessionInflight = new Map<string, Promise<PlayerSession[]>>();
const perPlayerClaimsCache = new Map<string, PlayerPrizeClaim[]>();
const perPlayerRegistrationsCache = new Map<string, TournamentRegistration[]>();
const perPlayerUnregistrationsCache = new Map<string, TournamentUnregistration[]>();
const tournamentRecordCache = new Map<string, TournamentStateDTO>();

const EMPTY_TOURNAMENTS: TournamentDirectory = {
    registrationsByPlayer: new Map(),
    unregistrationsByPlayer: new Map(),
    entriesByPlayer: new Map()
};

/** Drops cached chain and session reads. The reload button calls this. */
export function resetPlayersDirectoryCache(): void {
    globalClaims = undefined;
    globalClaimsInflight = null;
    globalUnsupported = false;
    globalTournaments = undefined;
    globalTournamentsInflight = null;
    globalTournamentsUnsupported = false;
    sessionCache.clear();
    sessionInflight.clear();
    perPlayerClaimsCache.clear();
    perPlayerRegistrationsCache.clear();
    perPlayerUnregistrationsCache.clear();
    tournamentRecordCache.clear();
}

/**
 * One page of the player directory with Sit & Go prizes and MTT registration
 * costs, refunds and payouts in net profit, matching the profile.
 *
 * The indexer pages and sorts by its own net, which only counts player_left_game.
 * Prize claims are one chain query (`sng_prize_claimed.player EXISTS`), grouped
 * by player. Tournament registrations and unregistrations are the same pattern
 * (`tournament_registered.player EXISTS` and `tournament_unregistered.player EXISTS`);
 * each unique tournament is then read once. The full directory is sorted and
 * paged here, so sorting by net uses the corrected values. Sessions for players
 * who were paid or entered an MTT are read so a prize or payout the indexer
 * already stored as a cash-out is not added again.
 *
 * A failed prize-claim query keeps the indexer figures. A failed tournament
 * query keeps the prize-corrected figures. A node that rejects a global query
 * falls back to per-player queries for the rows on the current page.
 */
export function usePlayersDirectory(params: PlayerSearchParams): UsePlayersDirectoryResult {
    const indexerApi = useIndexerApi();
    const cosmosApi = useCosmosApi();
    const { search, sort, order, limit, offset } = params;
    const [loaded, setLoaded] = useState<LoadedDirectory | null>(null);
    const [perPlayerView, setPerPlayerView] = useState<PerPlayerView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const loadedRef = useRef<LoadedDirectory | null>(null);
    const silentRef = useRef(false);

    const refetch = useCallback((options?: SilentRefetchOptions) => {
        resetPlayersDirectoryCache();
        silentRef.current = options?.silent === true;
        setReloadKey(key => key + 1);
    }, []);

    useEffect(() => {
        const searchKey = hasContent(search) ? search : "";
        const current = loadedRef.current;
        if (hasValue(current) && current.search === searchKey && current.reloadKey === reloadKey && current.mode !== "perPlayer") {
            return;
        }

        let cancelled = false;
        const silent = silentRef.current && hasValue(current);
        silentRef.current = false;
        if (!silent) {
            setLoading(true);
            setError(null);
        }

        const publish = (next: LoadedDirectory) => {
            loadedRef.current = next;
            setLoaded(next);
        };

        void (async () => {
            try {
                if (hasValue(current) && current.search === searchKey && current.reloadKey === reloadKey && current.mode === "perPlayer") {
                    const view = await correctVisiblePage(cosmosApi, indexerApi, current, { sort, order, limit, offset });
                    if (cancelled) return;
                    setPerPlayerView(view);
                    return;
                }

                const [raw, claims, tournaments] = await Promise.all([
                    fetchDirectory(indexerApi, hasContent(search) ? search : undefined),
                    loadGlobalClaims(cosmosApi),
                    loadGlobalTournaments(cosmosApi)
                ]);
                if (cancelled) return;

                if (claims === "failed") {
                    publish({ search: searchKey, reloadKey, mode: "indexer", raw, listed: raw });
                    setPerPlayerView(null);
                    return;
                }
                if (claims === "unsupported" || tournaments === "unsupported") {
                    const next = { search: searchKey, reloadKey, mode: "perPlayer" as const, raw, listed: raw };
                    publish(next);
                    const view = await correctVisiblePage(cosmosApi, indexerApi, next, { sort, order, limit, offset });
                    if (cancelled) return;
                    setPerPlayerView(view);
                    return;
                }

                const tournamentData = tournaments === "failed" ? EMPTY_TOURNAMENTS : tournaments;
                const listed = await listedWithAllVariants(indexerApi, raw, claims, tournamentData);
                if (cancelled) return;
                publish({
                    search: searchKey,
                    reloadKey,
                    mode: "global",
                    raw,
                    listed
                });
                setPerPlayerView(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to fetch players:", err);
                if (silent && hasValue(loadedRef.current)) {
                    setError(err instanceof Error ? err.message : "Failed to fetch players");
                    return;
                }
                loadedRef.current = null;
                setLoaded(null);
                setPerPlayerView(null);
                setError(err instanceof Error ? err.message : "Failed to fetch players");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [cosmosApi, indexerApi, limit, offset, order, reloadKey, search, sort]);

    const players = useMemo(() => {
        if (!hasValue(loaded)) return [];
        if (loaded.mode === "perPlayer") {
            if (!viewMatches(perPlayerView, loaded, { sort, order, limit, offset })) return [];
            return perPlayerView.players;
        }
        return playersPage(loaded.listed, sort, order, limit, offset);
    }, [limit, loaded, offset, order, perPlayerView, sort]);

    return { players, total: hasValue(loaded) ? loaded.raw.length : 0, loading, error, refetch };
}

function viewMatches(
    view: PerPlayerView | null,
    loaded: LoadedDirectory,
    params: Pick<PlayerSearchParams, "sort" | "order" | "limit" | "offset">
): view is PerPlayerView {
    if (!hasValue(view)) return false;
    return (
        view.search === loaded.search &&
        view.reloadKey === loaded.reloadKey &&
        view.sort === params.sort &&
        view.order === params.order &&
        view.limit === params.limit &&
        view.offset === params.offset
    );
}

async function fetchDirectory(indexerApi: IndexerApi, search: string | undefined): Promise<PlayerListItem[]> {
    return fetchAllPages((limit, offset) => indexerApi.getPlayers({ search, limit, offset }));
}

async function loadGlobalClaims(cosmosApi: CosmosApi): Promise<GlobalClaims> {
    if (globalUnsupported) return "unsupported";
    if (hasValue(globalClaims)) return globalClaims;
    if (hasValue(globalClaimsInflight)) return globalClaimsInflight;
    const inflight = readGlobalClaims(cosmosApi).finally(() => {
        globalClaimsInflight = null;
    });
    globalClaimsInflight = inflight;
    return inflight;
}

async function readGlobalClaims(cosmosApi: CosmosApi): Promise<GlobalClaims> {
    try {
        const body = await cosmosApi.getAllTransactionsMatching(ALL_PRIZE_CLAIMS_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS);
        const grouped = prizeClaimsByPlayer(body);
        globalClaims = grouped;
        return grouped;
    } catch (err) {
        if (isUnsupportedTxQuery(err)) {
            globalUnsupported = true;
            console.error("Global prize query is not supported; reading the visible page per player:", err);
            return "unsupported";
        }
        console.error("Failed to fetch prize claims:", err);
        return "failed";
    }
}

async function loadGlobalTournaments(cosmosApi: CosmosApi): Promise<GlobalTournaments> {
    if (globalTournamentsUnsupported) return "unsupported";
    if (hasValue(globalTournaments)) return globalTournaments;
    if (hasValue(globalTournamentsInflight)) return globalTournamentsInflight;
    const inflight = readGlobalTournaments(cosmosApi).finally(() => {
        globalTournamentsInflight = null;
    });
    globalTournamentsInflight = inflight;
    return inflight;
}

async function readGlobalTournaments(cosmosApi: CosmosApi): Promise<GlobalTournaments> {
    try {
        const [regBody, unregBody] = await Promise.all([
            cosmosApi.getAllTransactionsMatching(ALL_TOURNAMENT_REGISTERED_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS),
            cosmosApi.getAllTransactionsMatching(ALL_TOURNAMENT_UNREGISTERED_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS).catch(err => {
                console.error("Failed to fetch tournament unregistrations:", err);
                return null;
            })
        ]);
        const registrationsByPlayer = tournamentRegistrationsByPlayer(regBody);
        const unregistrationsByPlayer = hasValue(unregBody) ? tournamentUnregistrationsByPlayer(unregBody) : new Map();
        const entriesByPlayer = await entriesFromRegistrations(cosmosApi, registrationsByPlayer, unregistrationsByPlayer);
        const directory = { registrationsByPlayer, unregistrationsByPlayer, entriesByPlayer };
        globalTournaments = directory;
        return directory;
    } catch (err) {
        if (isUnsupportedTxQuery(err)) {
            globalTournamentsUnsupported = true;
            console.error("Global tournament query is not supported; reading the visible page per player:", err);
            return "unsupported";
        }
        console.error("Failed to fetch tournament directory:", err);
        return "failed";
    }
}

async function listedWithAllVariants(
    indexerApi: IndexerApi,
    players: PlayerListItem[],
    claims: Map<string, PlayerPrizeClaim[]>,
    tournaments: TournamentDirectory
): Promise<PlayerListItem[]> {
    const needed = players
        .filter(player => {
            const key = player.player_address.toLowerCase();
            return (
                hasElements(claims.get(key)) ||
                hasElements(tournaments.registrationsByPlayer.get(key)) ||
                hasElements(tournaments.unregistrationsByPlayer.get(key))
            );
        })
        .map(player => player.player_address);
    const sessions = await sessionsFor(indexerApi, needed);
    return playerListWithAllVariants(
        players,
        claims,
        sessions,
        tournaments.registrationsByPlayer,
        tournaments.entriesByPlayer,
        tournaments.unregistrationsByPlayer
    );
}

async function correctVisiblePage(
    cosmosApi: CosmosApi,
    indexerApi: IndexerApi,
    loaded: LoadedDirectory,
    params: Pick<PlayerSearchParams, "sort" | "order" | "limit" | "offset">
): Promise<PerPlayerView> {
    const visible = playersPage(loaded.raw, params.sort, params.order, params.limit, params.offset);
    const addresses = visible.map(player => player.player_address);
    const [claims, tournaments] = await Promise.all([claimsForPlayers(cosmosApi, addresses), tournamentsForPlayers(cosmosApi, addresses)]);
    const adjusted = await listedWithAllVariants(indexerApi, visible, claims, tournaments);
    const players =
        params.sort === "net_profit" && hasContent(params.order) ? playersPage(adjusted, params.sort, params.order, undefined, undefined) : adjusted;
    return {
        search: loaded.search,
        reloadKey: loaded.reloadKey,
        sort: params.sort,
        order: params.order,
        limit: params.limit,
        offset: params.offset,
        players
    };
}

async function claimsForPlayers(cosmosApi: CosmosApi, addresses: string[]): Promise<Map<string, PlayerPrizeClaim[]>> {
    const missing = addresses.filter(address => {
        const key = address.toLowerCase();
        return isPrizeClaimAddress(key) && !perPlayerClaimsCache.has(key);
    });
    await mapWithConcurrency(missing, DIRECTORY_FETCH_CONCURRENCY, async address => {
        const player = address.toLowerCase();
        try {
            const body = await cosmosApi.getAllTransactionsMatching(prizeClaimsQueryFor(player), PRIZE_DIRECTORY_QUERY_TIMEOUT_MS);
            perPlayerClaimsCache.set(player, prizeClaimsFromTxSearch(body, player));
        } catch (err) {
            console.error(`Failed to fetch prize claims for ${player}:`, err);
        }
    });
    const claims = new Map<string, PlayerPrizeClaim[]>();
    for (const address of addresses) {
        const cached = perPlayerClaimsCache.get(address.toLowerCase());
        if (hasValue(cached)) claims.set(address.toLowerCase(), cached);
    }
    return claims;
}

async function tournamentsForPlayers(cosmosApi: CosmosApi, addresses: string[]): Promise<TournamentDirectory> {
    const missing = addresses.filter(address => {
        const key = address.toLowerCase();
        return isPrizeClaimAddress(key) && !perPlayerRegistrationsCache.has(key);
    });
    await mapWithConcurrency(missing, DIRECTORY_FETCH_CONCURRENCY, async address => {
        const player = address.toLowerCase();
        try {
            const [regBody, unregBody] = await Promise.all([
                cosmosApi.getAllTransactionsMatching(tournamentRegisteredQuery(player), PRIZE_DIRECTORY_QUERY_TIMEOUT_MS),
                cosmosApi.getAllTransactionsMatching(tournamentUnregisteredQuery(player), PRIZE_DIRECTORY_QUERY_TIMEOUT_MS).catch(err => {
                    console.error(`Failed to fetch tournament unregistrations for ${player}:`, err);
                    return null;
                })
            ]);
            perPlayerRegistrationsCache.set(player, tournamentRegistrationsByPlayer(regBody).get(player) ?? []);
            perPlayerUnregistrationsCache.set(player, hasValue(unregBody) ? (tournamentUnregistrationsByPlayer(unregBody).get(player) ?? []) : []);
        } catch (err) {
            console.error(`Failed to fetch tournament entries for ${player}:`, err);
        }
    });
    const registrationsByPlayer = new Map<string, TournamentRegistration[]>();
    const unregistrationsByPlayer = new Map<string, TournamentUnregistration[]>();
    for (const address of addresses) {
        const key = address.toLowerCase();
        const registrations = perPlayerRegistrationsCache.get(key);
        if (hasValue(registrations)) registrationsByPlayer.set(key, registrations);
        const unregistrations = perPlayerUnregistrationsCache.get(key);
        if (hasValue(unregistrations)) unregistrationsByPlayer.set(key, unregistrations);
    }
    const entriesByPlayer = await entriesFromRegistrations(cosmosApi, registrationsByPlayer, unregistrationsByPlayer);
    return { registrationsByPlayer, unregistrationsByPlayer, entriesByPlayer };
}

async function entriesFromRegistrations(
    cosmosApi: CosmosApi,
    registrationsByPlayer: Map<string, TournamentRegistration[]>,
    unregistrationsByPlayer: Map<string, TournamentUnregistration[]>
): Promise<Map<string, PlayerTournamentEntry[]>> {
    const ids = uniqueTournamentIds([...registrationsByPlayer.values()].flat());
    const missing = ids.filter(id => !tournamentRecordCache.has(id.toLowerCase()));
    await mapWithConcurrency(missing, DIRECTORY_FETCH_CONCURRENCY, async id => {
        try {
            const record = readTournamentRecord(await cosmosApi.getTournament(id));
            if (hasValue(record)) tournamentRecordCache.set(id.toLowerCase(), record);
        } catch (err) {
            console.error("Failed to read tournament:", err);
        }
    });
    const recordsById = new Map<string, TournamentStateDTO>();
    for (const id of ids) {
        const record = tournamentRecordCache.get(id.toLowerCase());
        if (hasValue(record)) recordsById.set(id.toLowerCase(), record);
    }
    return tournamentEntriesByPlayer(registrationsByPlayer, recordsById, unregistrationsByPlayer);
}

async function sessionsFor(indexerApi: IndexerApi, addresses: string[]): Promise<Map<string, PlayerSession[]>> {
    await mapWithConcurrency(addresses, DIRECTORY_FETCH_CONCURRENCY, async address => {
        try {
            await readSessions(indexerApi, address);
        } catch (err) {
            console.error(`Failed to fetch sessions for ${address}:`, err);
        }
    });
    const sessions = new Map<string, PlayerSession[]>();
    for (const address of addresses) {
        const cached = sessionCache.get(address.toLowerCase());
        if (hasValue(cached)) sessions.set(address.toLowerCase(), cached);
    }
    return sessions;
}

async function readSessions(indexerApi: IndexerApi, address: string): Promise<PlayerSession[]> {
    const key = address.toLowerCase();
    const cached = sessionCache.get(key);
    if (hasValue(cached)) return cached;
    const pending = sessionInflight.get(key);
    if (hasValue(pending)) return pending;
    const request = fetchAllPages(async (limit, offset) => {
        const page = await indexerApi.getPlayerSessions(address, limit, offset);
        const data = Array.isArray(page?.data) ? page.data : [];
        const reportedTotal = page?.pagination?.total;
        const total = isNumber(reportedTotal) ? reportedTotal : data.length;
        return { data, pagination: { total } };
    })
        .then(sessions => {
            sessionCache.set(key, sessions);
            sessionInflight.delete(key);
            return sessions;
        })
        .catch(err => {
            sessionInflight.delete(key);
            throw err;
        });
    sessionInflight.set(key, request);
    return request;
}
