import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { microToUsdc } from "../constants/currency";
import { truncateMiddle } from "../utils/stringUtils";
import { ExplorerPage, explorerRowClass, explorerThClass, ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel, ExplorerReloadButton, ExplorerSearchInput } from "../components/explorer/ExplorerPanel";
import { isEmpty, hasElements } from "../utils/guards";
import { Pagination } from "../components/common";
import { VipBadge } from "../components/players/VipBadge";
import { usePlayersDirectory } from "../hooks/player/usePlayersDirectory";
import type { PlayerSortField } from "../types/players";

const PAGE_SIZE = 20;

const SORT_COLUMNS: ReadonlyArray<{ field: PlayerSortField; label: string; className: string; buttonClassName: string }> = [
    { field: "vip_points", label: "VIP", className: "hidden sm:table-cell", buttonClassName: "" },
    { field: "total_hands", label: "Hands", className: "text-right whitespace-nowrap", buttonClassName: "justify-end" },
    { field: "net_profit", label: "Net Profit", className: "text-right whitespace-nowrap", buttonClassName: "justify-end" },
    { field: "total_rake_contributed", label: "Rake", className: "text-right hidden sm:table-cell", buttonClassName: "justify-end" }
];

const sortButtonClass =
    "inline-flex items-center min-h-9 w-full uppercase tracking-[0.1em] font-semibold hover:text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light";

const formatUsd = (micro: number): string => {
    const value = microToUsdc(micro);
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PlayersPage() {
    const navigate = useNavigate();

    // The box is a draft; the applied search changes on Search/Enter (or when cleared).
    const [searchInput, setSearchInput] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [sort, setSort] = useState<PlayerSortField>("net_profit");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);

    const onSearchChange = (value: string) => {
        setSearchInput(value);
        // Clearing the box shows everyone again without another click.
        if (!value.trim()) setAppliedSearch("");
    };

    // Any filter/sort change returns to page 1.
    useEffect(() => {
        setPage(1);
    }, [appliedSearch, sort, order]);

    useEffect(() => {
        document.title = "Players - Block52 Explorer";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const params = useMemo(
        () => ({ search: appliedSearch, sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
        [appliedSearch, sort, order, page]
    );

    const { players, total, loading, error, refetch } = usePlayersDirectory(params);

    const toggleSort = (field: PlayerSortField) => {
        if (sort === field) {
            setOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSort(field);
            setOrder("desc");
        }
    };

    const ariaSort = (field: PlayerSortField) => (sort !== field ? "none" : order === "asc" ? "ascending" : "descending");

    const sortArrow = (field: PlayerSortField) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : "");

    return (
        <ExplorerPage title="Players">
                <ExplorerSearchInput
                    value={searchInput}
                    onChange={onSearchChange}
                    placeholder="Search players by address"
                    onSubmit={() => setAppliedSearch(searchInput.trim())}
                    busy={loading}
                />

                <ExplorerPanel
                    header={`Players${!loading && !error && total > 0 ? ` · ${total.toLocaleString()}` : ""}`}
                    action={<ExplorerReloadButton onClick={refetch} busy={loading} />}
                >
                    {loading ? (
                        <ExplorerLoading label="Loading players…" />
                    ) : error ? (
                        <ExplorerError>{error}</ExplorerError>
                    ) : isEmpty(players) ? (
                        <ExplorerEmpty>{appliedSearch ? "No players match that address." : "No players yet."}</ExplorerEmpty>
                    ) : (
                        <div className="overflow-x-auto" id="players-table-top">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className={`${explorerThClass} hidden sm:table-cell`}>#</th>
                                        <th className={explorerThClass}>Player</th>
                                        {SORT_COLUMNS.map(column => (
                                            <th key={column.field} className={`${explorerThClass} ${column.className}`} aria-sort={ariaSort(column.field)}>
                                                <button type="button" onClick={() => toggleSort(column.field)} className={`${sortButtonClass} ${column.buttonClassName}`}>
                                                    {column.label}
                                                    {sortArrow(column.field)}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((p, index) => (
                                        <tr
                                            key={p.player_address}
                                            className={`${explorerRowClass} cursor-pointer`}
                                            onClick={() => navigate(`/players/${p.player_address}`)}
                                        >
                                            <td className="hidden sm:table-cell px-4 py-2 text-ink-muted">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                            <td className="px-4 sm:px-5 py-3">
                                                <span className="font-mono text-xs sm:text-sm text-brand-light hover:underline">
                                                    {truncateMiddle(p.player_address, 12, 8)}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-4 sm:px-5 py-3">
                                                <VipBadge tier={p.vip_tier} rakebackPct={p.rakeback_pct} />
                                            </td>
                                            <td className="px-4 sm:px-5 py-3 text-right text-ink">{p.total_hands.toLocaleString()}</td>
                                            <td className="px-4 sm:px-5 py-3 text-right">
                                                <span className={p.net_profit >= 0 ? "text-green-400 [[data-theme=light]_&]:text-green-700 font-semibold" : "text-red-400 font-semibold"}>
                                                    {formatUsd(p.net_profit)}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-4 py-2 text-right text-ink-soft">{formatUsd(p.total_rake_contributed)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && total > PAGE_SIZE && (
                        <Pagination
                            currentPage={page}
                            totalItems={total}
                            pageSize={PAGE_SIZE}
                            onPageChange={p => {
                                setPage(p);
                                document.getElementById("players-table-top")?.scrollIntoView({ behavior: "smooth" });
                            }}
                        />
                    )}
                </ExplorerPanel>

                {!loading && !error && hasElements(players) && (
                    <div className="sm:hidden mt-4 text-center text-ink-muted text-sm">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} players
                    </div>
                )}
        </ExplorerPage>
    );
}
