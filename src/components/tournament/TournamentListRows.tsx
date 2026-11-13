import React from "react";
import { Link } from "react-router-dom";
import { truncateMiddle } from "../../utils/stringUtils";
import type { TournamentListRow } from "../../utils/tournamentListRow";

interface TournamentListRowsProps {
    rows: TournamentListRow[];
    /** The list has a blinds column (it shows cash games too); a tournament row leaves it blank. */
    hasCashGames: boolean;
    clubName: string;
    clubLogo: string;
}

/**
 * Multi-table tournaments as rows of the lobby's table list: one row per
 * tournament, with its runners out of its maximum, never one per directed table.
 */
export const TournamentListRows: React.FC<TournamentListRowsProps> = ({ rows, hasCashGames, clubName, clubLogo }) => (
    <>
        {rows.map(row => (
            <tr key={row.tournamentId} className="hover:bg-gray-700/50 transition-colors" data-testid="lobby-tournament-row">
                <td className="hidden sm:table-cell px-2 sm:px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                        <img src={clubLogo} alt={clubName} className="w-6 h-6 object-contain" />
                        <span className="text-white">{clubName}</span>
                    </div>
                </td>
                <td className="px-2 sm:px-4 py-4">
                    <div className="flex items-center justify-center gap-2 min-w-0">
                        <span className="text-gray-300 font-mono text-sm truncate" title={row.tournamentId}>
                            {truncateMiddle(row.tournamentId, 4, 4)}
                        </span>
                    </div>
                </td>
                {hasCashGames && (
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-4 text-center">
                        <span className="text-gray-500">-</span>
                    </td>
                )}
                <td className="hidden md:table-cell px-2 sm:px-4 py-4 text-center">
                    <span className="text-white" data-testid="lobby-format">
                        Tournament
                    </span>
                </td>
                <td className="hidden sm:table-cell px-2 sm:px-4 py-4 text-center">
                    <span className="text-white" data-testid="lobby-game">
                        Texas Hold&apos;em
                    </span>
                </td>
                <td className="px-2 sm:px-4 py-4 text-center">
                    <span className="text-white font-semibold" data-testid="lobby-tournament-runners">
                        {row.runners}
                    </span>
                </td>
                <td className="px-2 sm:px-4 py-4 text-center">
                    <span className="block truncate text-gray-300 font-mono text-sm">{row.buyIn}</span>
                </td>
                <td className="px-2 sm:px-4 py-4 text-center">
                    <Link
                        to={row.action.url}
                        className="inline-block px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 transition-all"
                        aria-label={`${row.action.label} tournament ${row.tournamentId}, ${row.runners} runners`}
                    >
                        {row.action.label}
                    </Link>
                </td>
            </tr>
        ))}
    </>
);

export default TournamentListRows;
