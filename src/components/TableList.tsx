import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFindGames, treasuryAddress } from "../hooks/game/useFindGames";
import { GameWithFormat } from "../utils/convertUtils";
import { useDeleteGame } from "../hooks/game/useDeleteGame";
import { useForceCloseGame } from "../hooks/game/useForceCloseGame";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { isCashFormat } from "../utils/gameFormatUtils";
import {
    TableFormatFilter,
    countByFormat,
    formatBlinds,
    formatLabel,
    formatTableBuyIn,
    isTableFull,
    matchesFormatFilter,
    matchesTableSearch,
    remainingCount,
    seatFillPercent,
    shortTableId,
    sngPrizeInfo,
    sortLobbyTables,
    tableDisplayName,
    variantAbbreviation
} from "../utils/lobbyTables";
import { cssVars } from "../utils/cssVars";
import { copyToClipboard } from "../utils/clipboard";
import DeleteTableModal from "./modals/DeleteTableModal";
import ForceCloseTableModal from "./modals/ForceCloseTableModal";
import { Pagination, SortButton, SortDirection } from "./common";
import { Card, PillButton, SegmentedControl, pillClass } from "./ui";
import styles from "./TableList.module.css";
import { hasContent, isNullish, isEmpty } from "../utils/guards";
import { viteEnv } from "../utils/viteEnv";

const PAGE_SIZE = 15;
/** Cards revealed per "Show more" tap on phones. */
const MOBILE_BATCH = 10;
const SKELETON_ROWS = 6;

const FORMAT_TAB_LABELS: ReadonlyArray<{ value: TableFormatFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "cash", label: "Cash" },
    { value: "sng", label: "Sit & Go" }
];

const thClass =
    "px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted whitespace-nowrap [&_button]:uppercase [&_button]:tracking-[0.1em] [&_button]:min-h-9";

const FeltIcon: React.FC<{ small?: boolean }> = ({ small = false }) => (
    <span aria-hidden="true" className={`flex-none rounded-full ${styles.felt} ${small ? "w-8 h-5" : "w-9 h-[22px]"}`} />
);

const SeatsBar: React.FC<{ game: GameWithFormat; barWidthClass: string }> = ({ game, barWidthClass }) => (
    <span className="flex items-center gap-3">
        <span className={`inline-block h-1 rounded-sm bg-line overflow-hidden ${barWidthClass}`}>
            <span className={`block h-full rounded-sm bg-yellow-500 ${styles.seatFill}`} style={cssVars({ "--seat-fill": `${seatFillPercent(game)}%` })} />
        </span>
        <span className="tabular-nums text-ink whitespace-nowrap">
            {game.currentPlayers} / {game.maxPlayers}
        </span>
    </span>
);

const SearchIcon: React.FC = () => (
    <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const TrashIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
    </svg>
);

const CloseIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const dangerIconClass =
    "w-11 h-11 md:w-9 md:h-9 grid place-items-center rounded-btn border border-red-400/40 text-red-400 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

interface TableListProps {
    onCreateTable?: () => void;
}

const TableList: React.FC<TableListProps> = ({ onCreateTable }) => {
    const { games: rawGames, isLoading, error, refetch } = useFindGames();
    const { deleteGame, isDeleting } = useDeleteGame();
    const { forceCloseGame, isClosing } = useForceCloseGame();
    const { address: cosmosAddress } = useCosmosWallet();
    const [deleteModalGameId, setDeleteModalGameId] = useState<string | null>(null);
    const [forceCloseGameTarget, setForceCloseGameTarget] = useState<GameWithFormat | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [mobileVisible, setMobileVisible] = useState(MOBILE_BATCH);
    const [formatFilter, setFormatFilter] = useState<TableFormatFilter>("all");
    const [playersSortDir, setPlayersSortDir] = useState<SortDirection>(null);
    const [formatSortDir, setFormatSortDir] = useState<SortDirection>(null);
    const [buyInSortDir, setBuyInSortDir] = useState<SortDirection>(null);
    const [gameIdSearch, setGameIdSearch] = useState("");
    const [showTreasuryOnly, setShowTreasuryOnly] = useState(hasContent(treasuryAddress));
    // Drives the full-width segmented control on phones. matchMedia is
    // guarded — jsdom lacks it; the fallback is sm-up.
    const [isSmUp, setIsSmUp] = useState<boolean>(() =>
        typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 640px)").matches : true
    );

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(min-width: 640px)");
        const onChange = (e: MediaQueryListEvent) => setIsSmUp(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    const resetPaging = useCallback(() => {
        setCurrentPage(1);
        setMobileVisible(MOBILE_BATCH);
    }, []);

    const handlePlayersSortClick = useCallback(() => {
        setPlayersSortDir(prev => {
            if (isNullish(prev)) return "desc";
            if (prev === "desc") return "asc";
            return null;
        });
        setFormatSortDir(null);
        setBuyInSortDir(null);
        resetPaging();
    }, [resetPaging]);

    const handleFormatSortClick = useCallback(() => {
        setFormatSortDir(prev => {
            if (isNullish(prev)) return "asc";
            if (prev === "asc") return "desc";
            return null;
        });
        setPlayersSortDir(null);
        setBuyInSortDir(null);
        resetPaging();
    }, [resetPaging]);

    const handleBuyInSortClick = useCallback(() => {
        setBuyInSortDir(prev => {
            if (isNullish(prev)) return "asc";
            if (prev === "asc") return "desc";
            return null;
        });
        setPlayersSortDir(null);
        setFormatSortDir(null);
        resetPaging();
    }, [resetPaging]);

    const handleGameIdSearch = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setGameIdSearch(e.target.value);
            resetPaging();
        },
        [resetPaging]
    );

    const handleFormatFilter = useCallback(
        (value: TableFormatFilter) => {
            setFormatFilter(value);
            resetPaging();
        },
        [resetPaging]
    );

    const handleTreasuryToggle = useCallback(() => {
        setShowTreasuryOnly(v => !v);
        resetPaging();
    }, [resetPaging]);

    const officialOnly = showTreasuryOnly && hasContent(treasuryAddress);

    // The pool the format tab counts are taken from: Official toggle and search applied, format tab not.
    const searchedGames = useMemo(() => {
        const treasury = hasContent(treasuryAddress) ? treasuryAddress.toLowerCase() : null;
        const pool = officialOnly && treasury !== null ? rawGames.filter(g => g.creator !== undefined && g.creator.toLowerCase() === treasury) : rawGames;
        return pool.filter(g => matchesTableSearch(g, gameIdSearch));
    }, [rawGames, officialOnly, gameIdSearch]);

    const formatCounts = useMemo(() => countByFormat(searchedGames), [searchedGames]);

    // Current tab, then sort (explicit header sort wins over the lobby default).
    const games = useMemo(() => {
        const filtered = searchedGames.filter(g => matchesFormatFilter(g, formatFilter));
        if (!isNullish(playersSortDir)) {
            return [...filtered].sort((a, b) => (playersSortDir === "desc" ? b.currentPlayers - a.currentPlayers : a.currentPlayers - b.currentPlayers));
        }
        if (!isNullish(formatSortDir)) {
            return [...filtered].sort((a, b) => {
                const cmp = String(a.gameFormat).localeCompare(String(b.gameFormat));
                return formatSortDir === "asc" ? cmp : -cmp;
            });
        }
        if (!isNullish(buyInSortDir)) {
            return [...filtered].sort((a, b) => {
                const diff = Number(a.minBuyIn) - Number(b.minBuyIn);
                return buyInSortDir === "asc" ? diff : -diff;
            });
        }
        return sortLobbyTables(filtered);
    }, [searchedGames, formatFilter, playersSortDir, formatSortDir, buyInSortDir]);

    // A refetch can leave fewer pages than the current one (a table was deleted).
    const page = Math.min(currentPage, Math.max(1, Math.ceil(games.length / PAGE_SIZE)));

    const pagedGames = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return games.slice(start, start + PAGE_SIZE);
    }, [games, page]);

    const mobileGames = useMemo(() => games.slice(0, mobileVisible), [games, mobileVisible]);
    const mobileRemaining = remainingCount(games.length, mobileVisible);

    const formatOptions = useMemo(
        () => FORMAT_TAB_LABELS.map(tab => ({ value: tab.value, label: tab.label, count: formatCounts[tab.value] })),
        [formatCounts]
    );

    const isSngTab = formatFilter === "sng";

    const clubName = viteEnv.VITE_CLUB_NAME;

    const handleDeleteGame = useCallback(async () => {
        if (deleteModalGameId === null) return;
        const result = await deleteGame(deleteModalGameId);
        if (result) {
            refetch();
        }
    }, [deleteModalGameId, deleteGame, refetch]);

    const handleForceCloseGame = useCallback(async () => {
        if (forceCloseGameTarget === null) return;
        const result = await forceCloseGame(forceCloseGameTarget.gameId);
        if (result) {
            refetch();
        }
    }, [forceCloseGameTarget, forceCloseGame, refetch]);

    const isCreator = (game: GameWithFormat) => {
        return cosmosAddress && game.creator && game.creator.toLowerCase() === cosmosAddress.toLowerCase();
    };

    const canDelete = (game: GameWithFormat) => isCreator(game) && game.currentPlayers === 0;

    // Cash-only: refund semantics for a partial SNG/Tournament are a separate product decision.
    const canForceClose = (game: GameWithFormat) => isCreator(game) && game.currentPlayers > 0 && isCashFormat(game.gameFormat);

    // Non-empty SNG/Tournament tables the creator owns: show the button
    // disabled with a tooltip so the creator knows it exists but is blocked.
    const canShowForceCloseDisabled = (game: GameWithFormat) => isCreator(game) && game.currentPlayers > 0 && !isCashFormat(game.gameFormat);

    const renderManageButtons = (game: GameWithFormat) => (
        <>
            {canDelete(game) && (
                <button
                    type="button"
                    onClick={() => setDeleteModalGameId(game.gameId)}
                    disabled={isDeleting}
                    className={dangerIconClass}
                    title="Delete table"
                    aria-label={`Delete ${tableDisplayName(game.gameId, game.name)}`}
                >
                    <TrashIcon />
                </button>
            )}
            {canForceClose(game) && (
                <button
                    type="button"
                    onClick={() => setForceCloseGameTarget(game)}
                    disabled={isClosing}
                    className={dangerIconClass}
                    title="Close table and refund all players"
                    aria-label={`Close ${tableDisplayName(game.gameId, game.name)} and refund all players`}
                >
                    <CloseIcon />
                </button>
            )}
            {canShowForceCloseDisabled(game) && (
                <button type="button" disabled className={dangerIconClass} title="Tournaments can't be force-closed." aria-label="Tournaments can't be force-closed">
                    <CloseIcon />
                </button>
            )}
        </>
    );

    const renderJoinLink = (game: GameWithFormat, size: "sm" | "md") => {
        const full = isTableFull(game);
        const label = full ? "Watch" : "Join";
        return (
            <a
                href={`/table/${game.gameId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} ${tableDisplayName(game.gameId, game.name)}, ${formatLabel(game.gameFormat)}, ${game.currentPlayers} of ${game.maxPlayers} players`}
                className={pillClass("outline", size, "min-w-[76px]")}
            >
                {label}
            </a>
        );
    };

    const renderNameBlock = (game: GameWithFormat, idSuffix: string) => (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-ink text-[15px] font-medium truncate" title={game.gameId}>
                {tableDisplayName(game.gameId, game.name)}
            </span>
            <span className="flex items-center gap-1 font-mono text-xs text-ink-muted whitespace-nowrap">
                {shortTableId(game.gameId)} · {idSuffix}
                <button
                    type="button"
                    onClick={() => copyToClipboard(game.gameId, "Table ID copied to clipboard!")}
                    className="w-11 h-11 -my-3 md:w-6 md:h-6 md:my-0 grid place-items-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                    title="Copy table ID"
                    aria-label="Copy table ID"
                >
                    <CopyIcon />
                </button>
            </span>
        </div>
    );

    /** Blinds column (cash) or prize pool column (Sit & Go tab / SNG rows on All). */
    const renderFourthCell = (game: GameWithFormat) => {
        if (isCashFormat(game.gameFormat)) {
            return <span className="text-ink tabular-nums">{formatBlinds(game)}</span>;
        }
        const prize = sngPrizeInfo(game);
        if (isSngTab) {
            return (
                <span className="flex flex-col gap-0.5">
                    <span className="text-ink tabular-nums">{prize.pool}</span>
                    {prize.split && <span className="text-xs text-ink-muted tabular-nums">{prize.split}</span>}
                </span>
            );
        }
        return <span className="text-ink-muted tabular-nums">Pool {prize.pool}</span>;
    };

    const header = (
        <div className="flex flex-wrap items-center justify-between gap-3.5">
            <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className="m-0 text-[22px] md:text-2xl font-semibold text-ink">Tables</h2>
                {hasContent(clubName) && <span className="text-ink-muted text-sm">{clubName} club</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="w-full sm:w-auto">
                    <SegmentedControl options={formatOptions} value={formatFilter} onChange={handleFormatFilter} ariaLabel="Game format" fullWidth={!isSmUp} />
                </div>
                <label className="flex items-center gap-2 h-11 px-3.5 flex-1 min-w-[180px] sm:flex-none sm:w-56 rounded-btn border border-line bg-surface-card text-ink-muted focus-within:border-brand transition-colors">
                    <SearchIcon />
                    <span className="sr-only">Search tables</span>
                    <input
                        type="search"
                        value={gameIdSearch}
                        onChange={handleGameIdSearch}
                        placeholder="Search tables"
                        className="flex-1 min-w-0 bg-transparent border-0 text-sm text-ink-body placeholder:text-ink-muted outline-none"
                    />
                </label>
                {treasuryAddress && (
                    <button
                        type="button"
                        aria-pressed={showTreasuryOnly}
                        onClick={handleTreasuryToggle}
                        title="Show only tables created by the official treasury"
                        className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-btn border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light ${
                            showTreasuryOnly ? "border-brand/50 bg-brand/15 text-brand-light" : "border-line text-ink-soft hover:text-ink hover:bg-surface-hover"
                        }`}
                    >
                        <svg className={`w-4 h-4 ${showTreasuryOnly ? "" : "opacity-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Official
                    </button>
                )}
                {onCreateTable && (
                    <PillButton variant="outline" size="md" onClick={onCreateTable}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Create table
                    </PillButton>
                )}
            </div>
        </div>
    );

    const renderBody = () => {
        if (isLoading) {
            return (
                <div aria-busy="true" aria-label="Loading tables">
                    {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 md:px-6 py-4 border-t border-line first:border-t-0 animate-pulse">
                            <span className="w-9 h-[22px] rounded-full bg-surface-hover flex-none" />
                            <span className="flex flex-col gap-2 flex-1 min-w-0">
                                <span className="h-3.5 w-28 rounded bg-surface-hover" />
                                <span className="h-3 w-20 rounded bg-surface-raised" />
                            </span>
                            <span className="hidden md:block h-3 w-16 rounded bg-surface-raised" />
                            <span className="hidden md:block h-3 w-24 rounded bg-surface-raised" />
                            <span className="h-9 w-[76px] rounded-btn bg-surface-raised flex-none" />
                        </div>
                    ))}
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center px-6 py-12">
                    <p className="text-red-400 mb-1 font-medium">Couldn't load tables</p>
                    <p className="text-ink-muted text-sm mb-4 break-words">{error.message}</p>
                    <PillButton variant="outline" size="md" onClick={refetch}>
                        Retry
                    </PillButton>
                </div>
            );
        }

        if (isEmpty(games)) {
            const filtering = gameIdSearch.trim().length > 0 || formatFilter !== "all" || officialOnly;
            return (
                <div className="px-6 py-12 text-center">
                    <p className="text-ink-body font-medium mb-1">{filtering ? "No tables match" : "No tables available"}</p>
                    <p className="text-ink-muted text-sm">{filtering ? "Try another format or search." : "Create the first table to start playing!"}</p>
                    {officialOnly && (
                        <PillButton variant="outline" size="md" onClick={handleTreasuryToggle} className="mt-4">
                            Show all tables
                        </PillButton>
                    )}
                    {!filtering && onCreateTable && (
                        <PillButton variant="primary" size="md" onClick={onCreateTable} className="mt-4">
                            Create table
                        </PillButton>
                    )}
                </div>
            );
        }

        return (
            <>
                <div className="hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={`${thClass} pl-6`}>Table</th>
                                    <th className={thClass}>
                                        <SortButton label="Format" direction={formatSortDir} onClick={handleFormatSortClick} />
                                    </th>
                                    <th className={thClass}>
                                        <SortButton label="Players" direction={playersSortDir} onClick={handlePlayersSortClick} />
                                    </th>
                                    <th className={thClass}>{isSngTab ? "Prize pool" : "Blinds"}</th>
                                    <th className={thClass}>
                                        <SortButton label="Buy-in" direction={buyInSortDir} onClick={handleBuyInSortClick} />
                                    </th>
                                    <th className={`${thClass} pr-6`}>
                                        <span className="sr-only">Action</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedGames.map(game => (
                                    <tr key={game.gameId} className="border-t border-line hover:bg-surface-raised transition-colors">
                                        <td className="pl-6 pr-4 py-3.5">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <FeltIcon />
                                                {renderNameBlock(game, variantAbbreviation(game.gameVariant))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-ink-soft">{formatLabel(game.gameFormat)}</td>
                                        <td className="px-4 py-3.5">
                                            <SeatsBar game={game} barWidthClass="w-[72px]" />
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">{renderFourthCell(game)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-ink-soft tabular-nums">{formatTableBuyIn(game)}</td>
                                        <td className="pl-4 pr-6 py-3.5">
                                            <div className="flex items-center justify-end gap-2">
                                                {renderManageButtons(game)}
                                                {renderJoinLink(game, "sm")}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination currentPage={page} totalItems={games.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="tables" />
                </div>

                <ul className="md:hidden m-0 p-0 list-none">
                    {mobileGames.map(game => (
                        <li key={game.gameId} className="flex flex-col gap-2.5 px-4 py-3.5 border-b border-line last:border-b-0">
                            <div className="flex items-center gap-3">
                                <FeltIcon small />
                                <div className="flex-1 min-w-0">{renderNameBlock(game, formatLabel(game.gameFormat))}</div>
                                {renderJoinLink(game, "md")}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pl-11 text-[13px] text-ink-soft tabular-nums">
                                <SeatsBar game={game} barWidthClass="w-11" />
                                {isCashFormat(game.gameFormat) && <span>{formatBlinds(game)}</span>}
                                <span className="text-ink-muted">{formatTableBuyIn(game)}</span>
                                <span className="flex items-center gap-2 ml-auto">{renderManageButtons(game)}</span>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="md:hidden border-t border-line">
                    {mobileRemaining > 0 ? (
                        <button
                            type="button"
                            onClick={() => setMobileVisible(v => v + MOBILE_BATCH)}
                            className="w-full h-[52px] text-sm font-medium text-brand-light hover:bg-surface-hover transition-colors"
                        >
                            Show more <span className="text-ink-muted tabular-nums">· {mobileRemaining} left</span>
                        </button>
                    ) : (
                        <p className="m-0 p-4 text-center text-sm text-ink-muted tabular-nums">
                            All {games.length} tables shown
                        </p>
                    )}
                </div>
            </>
        );
    };

    return (
        <section className="flex flex-col gap-4 min-w-0" aria-label="Tables">
            {header}
            <Card as="div">{renderBody()}</Card>

            {deleteModalGameId !== null && (
                <DeleteTableModal isOpen onClose={() => setDeleteModalGameId(null)} onConfirm={handleDeleteGame} gameId={deleteModalGameId} />
            )}

            {forceCloseGameTarget !== null && (
                <ForceCloseTableModal
                    isOpen
                    onClose={() => setForceCloseGameTarget(null)}
                    onConfirm={handleForceCloseGame}
                    gameId={forceCloseGameTarget.gameId}
                    seatedPlayerCount={forceCloseGameTarget.currentPlayers}
                />
            )}
        </section>
    );
};

export default TableList;
