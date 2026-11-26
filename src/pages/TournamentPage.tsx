import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel } from "../components/explorer/ExplorerPanel";
import { useTournament } from "../hooks/tournament/useTournament";
import { hasElements, isNullish } from "@block52/ui-sdk/helpers";
import { formatUSDCToSimpleDollars } from "@block52/poker-ui-core/utils/numberUtils";
import { truncateMiddle } from "@block52/poker-ui-core/utils/stringUtils";
import { tableUrl } from "@block52/poker-ui-core/utils/tableUrl";
import { liveTournamentTables, tournamentStandings } from "@block52/poker-ui-core/utils/tournamentTables";
import { startCountdownText } from "../utils/tournamentStart";
import { useNow } from "../hooks/tournament/useTournamentLobby";
import { tournamentSize } from "@block52/poker-ui-core/utils/tournamentResult";
import { getCosmosAddressSync } from "../utils/cosmosAccountUtils";
import { formatRunningLateRegistration, lateRegistrationWindow } from "@block52/poker-ui-core/utils/tournamentLateRegistration";

/**
 * /tournament/:tournamentId — one multi-table tournament: where it stands and
 * where its tables are. A player who is seated is sent straight to their table.
 */
export default function TournamentPage() {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const { tournament, isLoading, error, playersRemaining, myTable, level } = useTournament(tournamentId);
    const now = useNow(1000);

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
    const lateWindow = isNullish(tournament) ? undefined : lateRegistrationWindow(tournament, now);
    const lateLabel = isNullish(tournament) || isNullish(lateWindow) ? "" : formatRunningLateRegistration(tournament.options.lateRegistrationLevels, lateWindow);
    const waitingForSeat =
        !isNullish(tournament) && tournament.status === "running" && tournament.entrants.some(e => e.address.toLowerCase() === me && e.status === "registered");

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
                                {tournament.status === "registering" ? (
                                    <div>
                                        <dt className="text-gray-400">Starts in</dt>
                                        <dd className="text-white" data-testid="tournament-start-countdown">
                                            {startCountdownText(tournament.options.startTime, now)}
                                        </dd>
                                    </div>
                                ) : (
                                    <div>
                                        <dt className="text-gray-400">Level</dt>
                                        <dd className="text-white">{isNullish(level) ? "-" : level + 1}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-gray-400">Prize pool</dt>
                                    <dd className="text-white">${formatUSDCToSimpleDollars(tournament.prizePool)}</dd>
                                </div>
                            </dl>
                        </ExplorerPanel>

                        {waitingForSeat && (
                            <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 px-4 py-3 text-sm text-yellow-200" data-testid="tournament-waiting-for-seat">
                                You are registered. Waiting for a seat: you are placed at a table at the next hand, and this page then takes you to it.
                            </div>
                        )}

                        {lateLabel !== "" && (
                            <div
                                className={`rounded-lg border px-4 py-3 text-sm ${lateWindow?.open ? "border-green-700 bg-green-900/20 text-green-200" : "border-gray-700 text-gray-300"}`}
                                data-testid="tournament-late-registration"
                            >
                                {lateLabel}
                                {lateWindow?.open && (
                                    <>
                                        {" "}
                                        <Link to="/tournaments" className="text-blue-300 hover:underline">
                                            Register in the lobby
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}

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
                                            <span className={`min-w-0 ${row.address.toLowerCase() === me ? "text-green-300 font-semibold" : "text-white"}`}>
                                                {row.place}. <span className="font-mono break-all">{row.address}</span>
                                            </span>
                                            <span className="ml-3 shrink-0 text-gray-300">{row.payout !== "0" ? `$${formatUSDCToSimpleDollars(row.payout)}` : ""}</span>
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
