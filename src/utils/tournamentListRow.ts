import { formatMicroAsUsdc } from "../constants/currency";
import { tournamentUrl } from "./tableUrl";
import type { TournamentLobbyCard } from "./tournamentLobby";

/** What one multi-table tournament shows as a row of the lobby's table list. */
export interface TournamentListRow {
    tournamentId: string;
    /** Runners out of the most the tournament takes: "27/27". */
    runners: string;
    /** The buy-in: "$1.00". */
    buyIn: string;
    action: { label: string; url: string };
}

/**
 * The lobby row for a tournament. A tournament is one row, never one row per
 * table: its tables are directed by the tournament, so they cannot be joined,
 * and their seat counts are not the field size.
 */
export const tournamentListRow = (card: TournamentLobbyCard): TournamentListRow => {
    const registering = card.phase === "open";
    return {
        tournamentId: card.tournamentId,
        runners: `${card.registered}/${card.maxEntrants}`,
        buyIn: `$${formatMicroAsUsdc(card.cost.gross, 2)}`,
        action: registering
            ? { label: "Register", url: "/tournaments" }
            : { label: card.phase === "cancelled" ? "Cancelled" : card.phase === "full" ? "Full" : "View", url: tournamentUrl(card.tournamentId) }
    };
};
