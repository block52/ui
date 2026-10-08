import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { microToUsdc } from "../constants/currency";
import { truncateMiddle } from "../utils/stringUtils";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel, ExplorerReloadButton, ExplorerSearchInput } from "../components/explorer/ExplorerPanel";
import { isEmpty, hasElements } from "../utils/guards";
import { Pagination } from "../components/common";
import { VipBadge } from "../components/players/VipBadge";
import { usePlayersDirectory } from "../hooks/player/usePlayersDirectory";
import type { PlayerSortField } from "../types/players";
import styles from "./explorer/AllAccountsPage.module.css";

const PAGE_SIZE = 20;

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

    const sortArrow = (field: PlayerSortField) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : "");

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />

            <div className="max-w-5xl mx-auto relative z-10">
                <ExplorerHeader title="Players" />

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
                                    <tr className={styles.tableHeaderRow}>
                                        <th className="hidden sm:table-cell px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">#</th>
                                        <th className="px-3 sm:px-4 py-2 text-left text-gray-400 font-semibold">Player</th>
                                        <th
                                            className="hidden sm:table-cell px-3 sm:px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("vip_points")}
                                        >
                                            VIP{sortArrow("vip_points")}
                                        </th>
                                        <th
                                            className="px-3 sm:px-4 py-2 text-right text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("total_hands")}
                                        >
                                            Hands{sortArrow("total_hands")}
                                        </th>
                                        <th
                                            className="px-3 sm:px-4 py-2 text-right text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("net_profit")}
                                        >
                                            Net Profit{sortArrow("net_profit")}
                                        </th>
                                        <th
                                            className="hidden sm:table-cell px-4 py-2 text-right text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("total_rake_contributed")}
                                        >
                                            Rake{sortArrow("total_rake_contributed")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((p, index) => (
                                        <tr
                                            key={p.player_address}
                                            className={`border-t cursor-pointer hover:bg-white/5 transition-colors ${styles.tableRowBorder}`}
                                            onClick={() => navigate(`/players/${p.player_address}`)}
                                        >
                                            <td className="hidden sm:table-cell px-4 py-2 text-gray-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                            <td className="px-3 sm:px-4 py-2">
                                                <span className={`font-mono text-xs sm:text-sm hover:underline ${styles.brandText}`}>
                                                    {truncateMiddle(p.player_address, 12, 8)}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-3 sm:px-4 py-2">
                                                <VipBadge tier={p.vip_tier} rakebackPct={p.rakeback_pct} />
                                            </td>
                                            <td className="px-3 sm:px-4 py-2 text-right text-white">{p.total_hands.toLocaleString()}</td>
                                            <td className="px-3 sm:px-4 py-2 text-right">
                                                <span className={p.net_profit >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                                                    {formatUsd(p.net_profit)}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-4 py-2 text-right text-gray-300">{formatUsd(p.total_rake_contributed)}</td>
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
                    <div className="sm:hidden mt-4 text-center text-gray-400 text-sm">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} players
                    </div>
                )}
            </div>
        </div>
    );
}
