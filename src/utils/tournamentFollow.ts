import type { TournamentStateDTO } from "../types/tournament";

/** Engine table id (`<tournamentId>/t1`) to game id (`<tournamentId>-t1`): the last '/' becomes '-'. */
export const gameIdFromTableId = (tableId: string): string => {
    const i = tableId.lastIndexOf("/");
    if (i < 0) throw new Error(`tournament table id "${tableId}" has no "/"`);
    return `${tableId.slice(0, i)}-${tableId.slice(i + 1)}`;
};

export interface MyTournamentTable {
    /** Game id of the table the wallet plays at now (what /table/:id takes). */
    gameId: string;
    tableId: string;
    seat: number | undefined;
    /** 1-based position among the tournament's live tables, by ordinal. */
    tableNumber: number;
    /** How many tables are still live (not broken). */
    tableCount: number;
}

export interface TournamentProgress {
    /** Entrants still playing. */
    playersRemaining: number;
    /** Where the wallet plays, or undefined when it is not playing (not entered, busted, or not started). */
    myTable: MyTournamentTable | undefined;
}

/** Players remaining and the connected wallet's table, from the tournament record. */
export const tournamentProgress = (t: TournamentStateDTO, walletAddress: string | undefined): TournamentProgress => {
    const playersRemaining = t.entrants.filter(e => e.status === "playing").length;
    const live = t.tables.filter(x => !x.broken).sort((a, b) => a.ordinal - b.ordinal);
    const me = walletAddress ? t.entrants.find(e => e.address.toLowerCase() === walletAddress.toLowerCase()) : undefined;
    if (!me || me.status !== "playing" || !me.tableId) return { playersRemaining, myTable: undefined };
    const index = live.findIndex(x => x.tableId === me.tableId);
    return {
        playersRemaining,
        myTable: {
            gameId: gameIdFromTableId(me.tableId),
            tableId: me.tableId,
            seat: me.seat,
            tableNumber: index + 1,
            tableCount: live.length
        }
    };
};

/**
 * Where to send the player when the tournament moves them. Returns the new game
 * id only when the player was seated at the table being viewed (`previous`) and
 * the tournament now seats them elsewhere; a spectator of another table, or a
 * player who has not been moved, stays put.
 */
export const followTarget = (viewedGameId: string | undefined, previous: MyTournamentTable | undefined, current: MyTournamentTable | undefined): string | undefined => {
    if (!viewedGameId || !previous || !current) return undefined;
    if (previous.gameId !== viewedGameId) return undefined;
    return current.gameId === viewedGameId ? undefined : current.gameId;
};
