import type { ResultDTO } from "@block52/poker-vm-sdk";
import type { TournamentStateDTO } from "../types/tournament";
import { hasElements, isNullish } from "./guards";

/** A finisher's place and prize, in the shape the Sit & Go result modal shows. */
export interface FinisherResult {
    place: number;
    /** Raw payout, micro-USDC string; "0" outside the paid places. */
    payout: string;
    isWinner: boolean;
}

/**
 * The wallet's finishing place and prize from a tournament's results list, or
 * null while it has no result (not entered, or still playing). On a directed
 * table of a multi-table tournament the results live on the tournament record,
 * not on the table state, and a bust writes the result at once.
 */
export const finisherResult = (results: ResultDTO[] | undefined, address: string | undefined): FinisherResult | null => {
    if (!address || !hasElements(results)) return null;
    const mine = results.find(r => r.playerId.toLowerCase() === address.toLowerCase());
    if (!mine) return null;
    return { place: mine.place, payout: mine.payout, isWinner: mine.place === 1 };
};

/**
 * How many players the tournament started with: every entrant that did not
 * unregister before the start (registered, playing or busted). Undefined until
 * the record has loaded.
 */
export const tournamentSize = (t: TournamentStateDTO | undefined): number | undefined =>
    t ? t.entrants.filter(e => e.status !== "unregistered").length : undefined;

/** The field of a multi-table tournament: players still in out of everyone who started. */
export interface TournamentRunners {
    left: number;
    total: number;
}

/** Runners left and the starting field, from the tournament record; undefined until it has loaded. */
export const tournamentRunners = (t: TournamentStateDTO | undefined): TournamentRunners | undefined => {
    const total = tournamentSize(t);
    if (!t || isNullish(total)) return undefined;
    return { left: t.entrants.filter(e => e.status === "playing").length, total };
};

/**
 * The table header's count: runners left out of the field on a tournament table
 * ("21/27 Runners"), because one table's seats are not the field; seats taken
 * out of seats ("4/9 Players") on any other table.
 */
export const playersLabel = (seated: number, maxPlayers: number, runners: TournamentRunners | undefined): string =>
    runners ? `${runners.left}/${runners.total} Runners` : `${seated}/${maxPlayers} Players`;
