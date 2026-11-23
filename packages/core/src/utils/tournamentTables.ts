import type { TournamentStateDTO } from "../types/tournament";
import { gameIdFromTableId } from "./tournamentFollow";
import { tableUrl } from "./tableUrl";

export interface TournamentTableRow {
    /** The table's number in its route (`/tournament/<id>/table/<n>`): the `t<n>` of its id. */
    number: number;
    gameId: string;
    url: string;
    players: number;
    handNumber: number;
}

/** The tournament's live tables (broken ones are gone), in table order, with where each one lives. */
export const liveTournamentTables = (t: TournamentStateDTO): TournamentTableRow[] =>
    t.tables
        .filter(table => !table.broken)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map(table => {
            const gameId = gameIdFromTableId(table.tableId);
            return {
                number: Number(table.tableId.slice(table.tableId.lastIndexOf("/") + 2)),
                gameId,
                url: tableUrl(gameId),
                players: table.players.length,
                handNumber: table.handNumber
            };
        });

export interface TournamentStandingRow {
    place: number;
    address: string;
    /** Raw payout, micro-USDC; "0" outside the paid places. */
    payout: string;
}

/** Finished places, best first; players who busted together share a place and keep the order the engine wrote them. */
export const tournamentStandings = (t: TournamentStateDTO): TournamentStandingRow[] =>
    [...t.results].sort((a, b) => a.place - b.place).map(r => ({ place: r.place, address: r.playerId, payout: r.payout }));

/**
 * Is table `tableNumber` still part of the tournament? False for a table that has
 * been broken up and for one that never existed: its URL has nothing to show.
 */
export const isTournamentTableLive = (t: TournamentStateDTO, tableNumber: number): boolean => liveTournamentTables(t).some(row => row.number === tableNumber);
