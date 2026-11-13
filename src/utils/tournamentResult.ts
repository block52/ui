import type { ResultDTO } from "@block52/poker-vm-sdk";
import type { TournamentStateDTO } from "../types/tournament";
import { hasElements } from "./guards";

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
