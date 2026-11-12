/**
 * The ONE place that turns a game id into a table route, and a route back into
 * a game id. Every link or navigation to a table must use it.
 *
 * A directed table of a multi-table tournament has the game id
 * `<tournamentId>-t<n>` and lives at `/tournament/<tournamentId>/table/<n>`;
 * every other table (cash, sit & go) stays at `/table/<gameId>`.
 */

/** A directed table's game id: the tournament's 0x hash, then `-t<table number>`. */
const TOURNAMENT_GAME_ID = /^(0x[0-9a-fA-F]+)-t(\d+)$/;

export interface TournamentTableRef {
    tournamentId: string;
    tableNumber: number;
}

/** The tournament and table number of a directed table's game id; undefined for any other game id. */
export const parseTournamentGameId = (gameId: string): TournamentTableRef | undefined => {
    const match = TOURNAMENT_GAME_ID.exec(gameId);
    if (!match) return undefined;
    return { tournamentId: match[1], tableNumber: Number(match[2]) };
};

/** The game id of table `tableNumber` of a tournament. */
export const tournamentGameId = (tournamentId: string, tableNumber: number | string): string => `${tournamentId}-t${tableNumber}`;

/** A tournament's own page: standings and its tables. */
export const tournamentUrl = (tournamentId: string): string => `/tournament/${tournamentId}`;

export const tableUrl = (gameId: string): string => {
    const tournament = parseTournamentGameId(gameId);
    return tournament ? `/tournament/${tournament.tournamentId}/table/${tournament.tableNumber}` : `/table/${gameId}`;
};

/** The route params the table page can be mounted under: `/table/:id` or `/tournament/:tournamentId/table/:n`. */
export interface TableRouteParams {
    id?: string;
    tournamentId?: string;
    n?: string;
}

/** The game id a table route addresses, or undefined when the params name no table. */
export const gameIdFromRoute = ({ id, tournamentId, n }: TableRouteParams): string | undefined => {
    if (id) return id;
    if (tournamentId && n) return tournamentGameId(tournamentId, n);
    return undefined;
};

/** Is this pathname a multi-table tournament's table page (`/tournament/<id>/table/<n>`)? */
export const isTournamentTablePath = (pathname: string): boolean => /^\/tournament\/[^/]+\/table\/[^/]+$/.test(pathname);
