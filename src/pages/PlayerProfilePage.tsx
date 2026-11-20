import { formatMicroUsd } from "../utils/moneyDisplay";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { truncateMiddle } from "../utils/stringUtils";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
import { isEmpty, hasElements, hasValue, hasContent } from "../utils/guards";
import { Pagination } from "../components/common";
import { VipBadge } from "../components/players/VipBadge";
import { SessionHistoryFilter } from "../components/players/SessionHistoryFilter";
import { PlayingStyleTip } from "../components/players/PlayingStyleTip";
import { useHandContributions, usePlayingStyle } from "../hooks/player/useHandContributions";
import { usePlayerProfile } from "../hooks/player/usePlayerProfile";
import { useMyHandHistory } from "../hooks/player/useMyHandHistory";
import { useRecoveredHands } from "../hooks/player/useRecoveredHands";
import { NETWORK_PRESETS, useNetwork } from "../context/NetworkContext";
import { useCosmosApi } from "../context/CosmosApiContext";
import { useAllPlayerSessions } from "../hooks/player/usePlayerSessions";
import { usePlayerPrizeClaims } from "../hooks/player/usePlayerPrizeClaims";
import { usePlayerTournamentEntries } from "../hooks/player/usePlayerTournamentEntries";
import { useVisibleRefresh } from "../hooks/useVisibleRefresh";
import { useSessionEliminationBlocks } from "../hooks/player/useSessionEliminationBlocks";
import { useSessionGameMeta } from "../hooks/player/useSessionGameMeta";
import { sessionRowsWithPrizes } from "../utils/playerPrizeClaims";
import { profileMoneyWithAllVariants } from "../utils/profileStatsMoney";
import {
    mergeTournamentSessionRows,
    sessionMetasWithTournamentEntries,
    tableGameIdsOf,
    withTournamentHandLeaveBlocks
} from "../utils/playerTournamentEntries";
import { mergeHistoryHands } from "../utils/handHistoryCards";
import { endedHandsFromTxSearch } from "../utils/handHistoryRecover";
import { handEndedTableQuery, historyNetworks } from "../utils/handReplay";
import {
    defaultSessionVariant,
    filterSessionRows,
    sessionGameFilterOptions,
    sessionLabelsByGameId,
    uniqueGameIds
} from "../utils/sessionGameDisplay";
import { sessionCashOutAmountClass, sessionPrizeCashOutClass } from "../utils/sessionCashOut";
import { eliminationLookupsFor, sessionBustFor, sessionLeaveBlock } from "../utils/sessionBust";
import { handContributionNote, profitHandsToMeasure, type HandContributionTarget } from "../utils/handContribution";
import { formatHandsPlayed, handsPlayedReadFailed } from "../utils/handsPlayed";
import { profileHistoryHandsPending, profileStyleCardsPending } from "../utils/profileStatsLoading";
import { formatPlayingStyle, PLAYING_STYLE_FIGURES, playingStyleHands, playingStyleNote } from "../utils/playingStyle";
import {
    formatHistoryAmount,
    formatHistoryBlocks,
    handBelongsToSettledSession,
    handsForHistory,
    historyMoneyUnits,
    profileHistoryStats,
    sessionSpansForHistory,
    sessionStateRetentionNote,
    settledSessionCashOut,
    withHandContributions
} from "../utils/profileHistoryStats";
import styles from "./explorer/AllAccountsPage.module.css";

const SESSIONS_PAGE_SIZE = 20;
const NO_PROFIT_HANDS: HandContributionTarget[] = [];

const formatUsd = (micro: number): string => {
    const label = formatMicroUsd(micro, true);
    return label.startsWith("-") ? `-$${label.slice(1)}` : `$${label}`;
};

const StatCard: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = "text-white" }) => (
    <div className={`backdrop-blur-md p-5 rounded-xl shadow-2xl ${styles.containerCard}`}>
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
);

export default function PlayerProfilePage() {
    const { address } = useParams<{ address: string }>();
    const navigate = useNavigate();
    const [sessionsPage, setSessionsPage] = useState(1);
    const [copied, setCopied] = useState(false);
    const [gameFilter, setGameFilter] = useState("");

    const { profile, loading, error, refetch: refetchProfile } = usePlayerProfile(address);
    const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useAllPlayerSessions(address);
    // Chain prize claims. Empty on failure, so the cards and rows stay on the indexer.
    const { claims, loading: prizesLoading, refetch: refetchClaims } = usePlayerPrizeClaims(address);
    // MTT entry never joins a table, so the indexer has no session for it.
    const {
        entries: tournamentEntries,
        registrations: tournamentRegistrations,
        unregistrations: tournamentUnregistrations,
        loading: tournamentsLoading,
        refetch: refetchTournaments
    } = usePlayerTournamentEntries(address);
    const { currentNetwork } = useNetwork();
    const cosmosApi = useCosmosApi();

    const handHistory = useMyHandHistory(hasContent(address) ? address : null, `${currentNetwork.name}|${currentNetwork.rest}`, 1000);
    const extraGameIds = useMemo(() => [...new Set(tournamentEntries.flatMap(tableGameIdsOf))], [tournamentEntries]);
    const historyNodes = useMemo(() => historyNetworks(currentNetwork, NETWORK_PRESETS), [currentNetwork]);
    const endedHands = useCallback(
        async (gameId: string) => {
            try {
                return endedHandsFromTxSearch(await cosmosApi.getAllTransactionsMatching(handEndedTableQuery(gameId)), gameId);
            } catch (err) {
                console.error("Failed to list tournament hand_ended events:", err);
                return [];
            }
        },
        [cosmosApi]
    );
    const recovered = useRecoveredHands(
        hasContent(address) ? address : null,
        handHistory.hands,
        handHistory.complete && !hasContent(handHistory.error),
        historyNodes,
        { extraGameIds, endedHands }
    );
    const listedHands = useMemo(
        () => mergeHistoryHands(hasContent(handHistory.error) ? [] : handHistory.hands, recovered.hands),
        [handHistory.error, handHistory.hands, recovered.hands]
    );
    const gameIds = useMemo(
        () =>
            uniqueGameIds([
                ...sessions.map(session => session.game_id),
                ...listedHands.map(hand => hand.game_id),
                ...tournamentEntries.map(entry => entry.gameId),
                ...extraGameIds
            ]),
        [sessions, listedHands, tournamentEntries, extraGameIds]
    );
    const { byId: fetchedGames, loading: gamesLoading } = useSessionGameMeta(gameIds);
    const gamesById = useMemo(
        () => sessionMetasWithTournamentEntries(fetchedGames, tournamentEntries, listedHands),
        [fetchedGames, tournamentEntries, listedHands]
    );
    const rows = useMemo(
        () => mergeTournamentSessionRows(sessionRowsWithPrizes(sessions, claims), tournamentEntries, listedHands, address),
        [sessions, claims, tournamentEntries, listedHands, address]
    );
    const gameLabels = useMemo(() => sessionLabelsByGameId(gamesById), [gamesById]);
    const gameFilterOptions = useMemo(() => sessionGameFilterOptions(Object.values(gameLabels)), [gameLabels]);
    const defaultVariant = useMemo(() => defaultSessionVariant(rows, gameLabels), [rows, gameLabels]);
    const filteredRows = useMemo(() => filterSessionRows(rows, gameLabels, gameFilter), [rows, gameLabels, gameFilter]);
    const pageRows = useMemo(() => {
        const start = (sessionsPage - 1) * SESSIONS_PAGE_SIZE;
        return filteredRows.slice(start, start + SESSIONS_PAGE_SIZE);
    }, [filteredRows, sessionsPage]);
    // Every filtered bust, not only the visible page, so the longest session does not depend on which page is open.
    const eliminationLookups = useMemo(() => eliminationLookupsFor(filteredRows, rows, gamesById, address), [filteredRows, rows, gamesById, address]);
    const chainLeaveBlocks = useSessionEliminationBlocks(address, eliminationLookups);
    const eliminationBlocks = useMemo(
        () => withTournamentHandLeaveBlocks(chainLeaveBlocks, tournamentEntries, listedHands),
        [chainLeaveBlocks, tournamentEntries, listedHands]
    );
    const settledWindows = useMemo(
        () =>
            filteredRows.map(row => ({
                gameId: row.gameId,
                joinBlock: row.joinBlock,
                cashOut: settledSessionCashOut(row, hasContent(address) && hasValue(sessionBustFor(row, rows, gamesById[row.gameId], address)))
            })),
        [filteredRows, address, rows, gamesById]
    );
    const settledHands = useMemo(
        () => listedHands.filter(hand => handBelongsToSettledSession({ gameId: hand.game_id, blockHeight: hand.block_height }, settledWindows)),
        [listedHands, settledWindows]
    );
    const profitHands = useMemo(
        () =>
            gamesLoading || hasContent(handHistory.error) || !hasContent(gameFilter)
                ? undefined
                : profitHandsToMeasure(settledHands, gameLabels, historyMoneyUnits(gamesById), gameFilter),
        [gamesLoading, handHistory.error, gameFilter, settledHands, gameLabels, gamesById]
    );
    const contributions = useHandContributions(address, profitHands ?? NO_PROFIT_HANDS, hasValue(profitHands));
    const styleSelection = useMemo(() => playingStyleHands(listedHands), [listedHands]);
    const styleRead = usePlayingStyle(address, styleSelection.hands, hasContent(address) && !hasContent(handHistory.error));
    const stylePending = profileStyleCardsPending({
        onStatsTab: true,
        hasAddress: hasContent(address),
        handListFailed: hasContent(handHistory.error),
        handListComplete: handHistory.complete,
        styleLogsPending: styleRead.pending,
        recoveredSearched: recovered.searched,
        styleDealt: styleRead.dealt
    });
    const styleDisplay = formatPlayingStyle(styleRead.counts, stylePending);
    const handsPlayedLabel = formatHandsPlayed({
        pending: stylePending,
        failed: handsPlayedReadFailed(hasContent(handHistory.error), styleSelection.hands.length, styleRead.dealt, styleRead.unavailable),
        dealt: styleRead.dealt,
        indexerHands: hasValue(profile) ? profile.total_hands : undefined
    });
    const styleNote = stylePending ? undefined : playingStyleNote(styleRead.counts.hands, styleRead.unavailable + styleSelection.dropped);
    const historyHands = useMemo(
        () => withHandContributions(hasContent(handHistory.error) ? [] : handsForHistory(settledHands), contributions.byKey),
        [handHistory.error, settledHands, contributions.byKey]
    );
    const historyStats = useMemo(
        () =>
            profileHistoryStats(
                sessionSpansForHistory(rows, gamesById, address, eliminationBlocks),
                historyHands,
                gameLabels,
                historyMoneyUnits(gamesById),
                gameFilter
            ),
        [rows, gamesById, address, eliminationBlocks, historyHands, gameLabels, gameFilter]
    );
    const handsPending = profileHistoryHandsPending({
        onStatsTab: true,
        hasAddress: hasContent(address),
        handListFailed: hasContent(handHistory.error),
        handListComplete: handHistory.complete
    });
    const moneyLoading = handsPending || handHistory.loading || gamesLoading;
    const profitLoading = moneyLoading || contributions.pending;
    const profitNote = profitLoading ? undefined : handContributionNote(contributions.unavailable, hasValue(profitHands) ? profitHands.length : 0);
    const statsMoney = useMemo(
        () =>
            hasValue(profile) && !prizesLoading && !tournamentsLoading
                ? profileMoneyWithAllVariants(
                      { totalBuyIns: profile.total_buy_ins, totalCashOuts: profile.total_cash_outs, netProfit: profile.net_profit },
                      sessions,
                      claims,
                      tournamentEntries,
                      tournamentRegistrations,
                      tournamentUnregistrations,
                      address
                  )
                : null,
        [profile, prizesLoading, tournamentsLoading, sessions, claims, tournamentEntries, tournamentRegistrations, tournamentUnregistrations, address]
    );
    const historyLoading = sessionsLoading || prizesLoading || tournamentsLoading;

    useVisibleRefresh(() => {
        refetchProfile({ silent: true });
        refetchSessions({ silent: true });
        refetchClaims({ silent: true });
        refetchTournaments({ silent: true });
    });

    useEffect(() => {
        document.title = address ? `Player ${truncateMiddle(address, 8, 6)} - Block52` : "Player - Block52";
        return () => {
            document.title = "Block52 Chain";
        };
    }, [address]);

    useEffect(() => {
        setGameFilter("");
        setSessionsPage(1);
    }, [address]);

    useEffect(() => {
        if (historyLoading || gamesLoading || !hasContent(defaultVariant)) return;
        setGameFilter(current => (gameFilterOptions.some(option => option.key === current) ? current : defaultVariant));
    }, [historyLoading, gamesLoading, defaultVariant, gameFilterOptions]);

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />

            <div className="max-w-7xl mx-auto relative z-10">
                <ExplorerHeader title="Player Profile" />

                <button onClick={() => navigate("/players")} className="mb-4 text-sm text-gray-400 hover:text-white transition-colors">
                    ← Back to players
                </button>

                {loading ? (
                    <div className={`backdrop-blur-md rounded-xl shadow-2xl p-8 text-center ${styles.containerCard}`}>
                        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${styles.loadingSpinner}`}></div>
                        <p className="text-gray-400">Loading player...</p>
                    </div>
                ) : error ? (
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard} ${styles.errorContainer}`}>
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                ) : !profile ? (
                    <div className={`backdrop-blur-md p-8 rounded-xl shadow-2xl text-center ${styles.containerCard}`}>
                        <p className="text-gray-400">No data for this player.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`font-mono text-sm break-all ${styles.brandText}`}>{profile.player_address}</span>
                                    <button onClick={copyAddress} className="text-xs text-gray-400 hover:text-white transition-colors">
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                                <VipBadge tier={profile.vip_tier} rakebackPct={profile.rakeback_pct} showRakeback />
                            </div>
                        </div>

                        {/* Volume & money */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatCard label="Hands Played" value={handsPlayedLabel} />
                            <StatCard
                                label="Net Profit"
                                value={hasValue(statsMoney) ? formatUsd(statsMoney.netProfit) : "…"}
                                valueClass={hasValue(statsMoney) && statsMoney.netProfit < 0 ? "text-red-400" : "text-green-400"}
                            />
                            <StatCard label="Total Buy-In" value={hasValue(statsMoney) ? formatUsd(statsMoney.totalBuyIns) : "…"} />
                            <StatCard label="Total Cash-Out" value={hasValue(statsMoney) ? formatUsd(statsMoney.totalCashOuts) : "…"} />
                            <StatCard label="Sessions" value={profile.session_count.toLocaleString()} />
                            <StatCard label="Total Actions" value={profile.total_actions.toLocaleString()} />
                            <StatCard label="Network Fees Paid" value={formatUsd(profile.total_rake_contributed)} />
                            <StatCard label="VIP Points" value={profile.vip_points.toLocaleString()} />
                        </div>

                        {/* Playing style: every variant, from the chain action logs. */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                            <h2 className="text-white font-bold mb-4">Playing Style</h2>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {PLAYING_STYLE_FIGURES.map(figure => (
                                    <div key={figure.key}>
                                        <div className="flex items-center gap-1">
                                            <p className="text-gray-400 text-sm mb-1">{figure.title}</p>
                                            <PlayingStyleTip figure={figure} />
                                        </div>
                                        <p className="text-xl font-bold text-white">{styleDisplay[figure.key]}</p>
                                    </div>
                                ))}
                            </div>
                            {hasContent(styleNote) && <p className="mt-3 text-xs text-gray-500">{styleNote}</p>}
                        </div>

                        {/* Records + session history, driven by the same variant filter. */}
                        <div className={`backdrop-blur-md rounded-xl shadow-2xl overflow-hidden ${styles.containerCard}`}>
                            <div className="relative z-20 px-6 py-4 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-white font-bold">Session History</h2>
                                {!gamesLoading && hasContent(gameFilter) && hasElements(gameFilterOptions) && (
                                    <SessionHistoryFilter
                                        value={gameFilter}
                                        options={gameFilterOptions}
                                        onChange={key => {
                                            setGameFilter(key);
                                            setSessionsPage(1);
                                        }}
                                    />
                                )}
                            </div>
                            {historyLoading || (hasElements(rows) && (gamesLoading || !hasContent(gameFilter))) ? (
                                <div className="p-8 text-center">
                                    <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3 ${styles.loadingSpinner}`}></div>
                                    <p className="text-gray-400">Loading sessions...</p>
                                </div>
                            ) : isEmpty(rows) || !hasContent(gameFilter) ? (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400">No sessions recorded</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 sm:p-6 border-b border-white/10">
                                        <StatCard
                                            label="Biggest Pot Won"
                                            value={formatHistoryAmount(historyStats.biggestPotWon, historyStats.potUnit, moneyLoading)}
                                        />
                                        <StatCard
                                            label="Biggest Hand Profit"
                                            value={formatHistoryAmount(historyStats.biggestHandProfit, historyStats.profitUnit, profitLoading)}
                                        />
                                        <StatCard
                                            label="Longest Session (blocks)"
                                            value={formatHistoryBlocks(historyStats.longestSessionBlocks, historyLoading)}
                                        />
                                    </div>
                                    <p className="px-6 pt-3 text-xs text-gray-500">{sessionStateRetentionNote()}</p>
                                    {hasContent(profitNote) && <p className="px-6 pt-1 pb-3 text-xs text-gray-500">{profitNote}</p>}
                                    {isEmpty(filteredRows) ? (
                                        <div className="p-8 text-center">
                                            <p className="text-gray-400">No sessions for this game</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className={styles.tableHeaderRow}>
                                                        <th className="px-6 py-4 text-left text-gray-400 font-semibold">Game</th>
                                                        <th className="px-6 py-4 text-right text-gray-400 font-semibold">Join Block</th>
                                                        <th className="px-6 py-4 text-right text-gray-400 font-semibold">Leave Block</th>
                                                        <th className="px-6 py-4 text-right text-gray-400 font-semibold">Buy-In</th>
                                                        <th className="px-6 py-4 text-right text-gray-400 font-semibold">Cash-Out</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pageRows.map((row, i) => {
                                                        const bust = sessionBustFor(row, rows, gamesById[row.gameId], profile.player_address);
                                                        const leave = sessionLeaveBlock(row, bust, eliminationBlocks[row.gameId]);
                                                        const label = gameLabels[row.gameId];
                                                        const cashOutClass = row.isPrize
                                                            ? sessionPrizeCashOutClass()
                                                            : sessionCashOutAmountClass(row.buyIn, row.cashOut);
                                                        return (
                                                            <tr key={`${row.gameId}-${row.joinBlock}-${i}`} className={`border-t ${styles.tableRowBorder}`}>
                                                                <td className="px-6 py-4">
                                                                    {hasValue(label) ? (
                                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                                            <span className="text-sm text-white">{label.title}</span>
                                                                            {hasContent(label.detail) && <span className="text-xs text-gray-400">{label.detail}</span>}
                                                                            <span className={`font-mono text-xs ${styles.brandText}`}>
                                                                                {truncateMiddle(row.gameId, 8, 6)}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className={`font-mono text-sm ${styles.brandText}`}>
                                                                            {truncateMiddle(row.gameId, 8, 6)}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-gray-300">{row.joinBlock.toLocaleString()}</td>
                                                                <td className="px-6 py-4 text-right text-gray-300">
                                                                    {hasValue(leave) ? leave.toLocaleString() : "—"}
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-gray-300">{formatUsd(row.buyIn)}</td>
                                                                <td className="px-6 py-4 text-right text-gray-300">
                                                                    {hasValue(row.cashOut) ? (
                                                                        <span className={hasContent(cashOutClass) ? cashOutClass : undefined}>{formatUsd(row.cashOut)}</span>
                                                                    ) : (
                                                                        "—"
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {!historyLoading && hasElements(filteredRows) && filteredRows.length > SESSIONS_PAGE_SIZE && (
                                        <Pagination
                                            currentPage={sessionsPage}
                                            totalItems={filteredRows.length}
                                            pageSize={SESSIONS_PAGE_SIZE}
                                            onPageChange={setSessionsPage}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
