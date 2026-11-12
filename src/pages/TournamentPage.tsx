import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel } from "../components/explorer/ExplorerPanel";
import { useTournament } from "../hooks/tournament/useTournament";
import { hasElements, isNullish } from "../utils/guards";
import { formatUSDCToSimpleDollars } from "../utils/numberUtils";
import { truncateMiddle } from "../utils/stringUtils";
import { tableUrl } from "../utils/tableUrl";
import { liveTournamentTables, tournamentStandings } from "../utils/tournamentTables";
import { tournamentSize } from "../utils/tournamentResult";
import { getCosmosAddressSync } from "../utils/cosmosAccountUtils";

/**
 * /tournament/:tournamentId — one multi-table tournament: where it stands and
 * where its tables are. A player who is seated is sent straight to their table.
 */
export default function TournamentPage() {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const { tournament, isLoading, error, playersRemaining, myTable, level } = useTournament(tournamentId);

    useEffect(() => {
        document.title = "Tournament - Block52";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    if (myTable) {
        return <Navigate to={tableUrl(myTable.gameId)} replace />;
    }

    const me = getCosmosAddressSync()?.toLowerCase();

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />
            <div className="max-w-3xl mx-auto relative z-10">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h1 className="text-2xl font-bold text-white">Tournament {tournamentId ? truncateMiddle(tournamentId, 6, 4, "…") : ""}</h1>
                    <Link to="/tournaments" className="text-sm text-blue-300 hover:underline">
                        All tournaments
                    </Link>
                </div>

                {isNullish(tournament) ? (
                    isLoading ? (
                        <ExplorerLoading label="Loading tournament…" />
                    ) : error ? (
                        <ExplorerError>{error.message}</ExplorerError>
                    ) : (
                        <ExplorerEmpty>This tournament was not found.</ExplorerEmpty>
                    )
                ) : (
                    <div className="space-y-4">
                        <ExplorerPanel header="Status">
                            <dl className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm" data-testid="tournament-summary">
                                <div>
                                    <dt className="text-gray-400">Status</dt>
                                    <dd className="text-white capitalize">{tournament.status}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400">Runners</dt>
                                    <dd className="text-white">
                                        {tournament.status === "registering"
                                            ? `${tournamentSize(tournament)} / ${tournament.options.maxEntrants}`
                                            : `${playersRemaining} left of ${tournamentSize(tournament)}`}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400">Level</dt>
                                    <dd className="text-white">{isNullish(level) ? "-" : level + 1}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400">Prize pool</dt>
                                    <dd className="text-white">${formatUSDCToSimpleDollars(tournament.prizePool)}</dd>
                                </div>
                            </dl>
                        </ExplorerPanel>

                        <ExplorerPanel header="Tables">
                            {hasElements(liveTournamentTables(tournament)) ? (
                                <ul className="divide-y divide-gray-700/50">
                                    {liveTournamentTables(tournament).map(row => (
                                        <li key={row.gameId} className="flex items-center justify-between px-4 py-3 text-sm">
                                            <span className="text-white">
                                                Table {row.number} <span className="text-gray-400">({row.players} players, hand {row.handNumber})</span>
                                            </span>
                                            <Link to={row.url} className="text-blue-300 hover:underline" data-testid={`tournament-table-${row.number}`}>
                                                Watch
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <ExplorerEmpty>{tournament.status === "registering" ? "Tables are drawn when the tournament starts." : "No tables are playing."}</ExplorerEmpty>
                            )}
                        </ExplorerPanel>

                        {hasElements(tournament.results) && (
                            <ExplorerPanel header="Finished">
                                <ol className="divide-y divide-gray-700/50" data-testid="tournament-standings">
                                    {tournamentStandings(tournament).map(row => (
                                        <li key={`${row.place}-${row.address}`} className="flex items-center justify-between px-4 py-2 text-sm">
                                            <span className={row.address.toLowerCase() === me ? "text-green-300 font-semibold" : "text-white"}>
                                                {row.place}. <span className="font-mono">{truncateMiddle(row.address, 8, 6, "…")}</span>
                                            </span>
                                            <span className="text-gray-300">{row.payout !== "0" ? `$${formatUSDCToSimpleDollars(row.payout)}` : ""}</span>
                                        </li>
                                    ))}
                                </ol>
                            </ExplorerPanel>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
