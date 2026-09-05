import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { microToUsdc } from "../constants/currency";
import { truncateMiddle } from "../utils/stringUtils";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
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

    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sort, setSort] = useState<PlayerSortField>("net_profit");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);

    // Debounce the search box so we don't hit the indexer on every keystroke.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    // Any filter/sort change returns to page 1.
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, sort, order]);

    useEffect(() => {
        document.title = "Players - Block52 Explorer";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const params = useMemo(
        () => ({ search: debouncedSearch, sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
        [debouncedSearch, sort, order, page]
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
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />

            <div className="max-w-7xl mx-auto relative z-10">
                <ExplorerHeader title="Players" />

                {/* Search + Refresh */}
                <div className={`backdrop-blur-md p-4 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="Search by player address..."
                            className={`flex-1 px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${styles.searchInput}`}
                        />
                        <button
                            onClick={refetch}
                            disabled={loading}
                            className={`px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 ${styles.refreshButton}`}
                        >
                            {loading ? "Loading..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard} ${styles.errorContainer}`}>
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                )}

                {!error && (
                    <div className={`backdrop-blur-md rounded-xl shadow-2xl overflow-hidden ${styles.containerCard}`}>
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${styles.loadingSpinner}`}></div>
                                <p className="text-gray-400">Loading players...</p>
                            </div>
                        ) : isEmpty(players) ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-400">No players found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" id="players-table-top">
                                <table className="w-full">
                                    <thead>
                                        <tr className={styles.tableHeaderRow}>
                                            <th className="px-6 py-4 text-left text-gray-400 font-semibold">#</th>
                                            <th className="px-6 py-4 text-left text-gray-400 font-semibold">Player</th>
                                            <th
                                                className="px-6 py-4 text-left text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
                                                onClick={() => toggleSort("vip_points")}
                                            >
                                                VIP{sortArrow("vip_points")}
                                            </th>
                                            <th
                                                className="px-6 py-4 text-right text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
                                                onClick={() => toggleSort("total_hands")}
                                            >
                                                Hands{sortArrow("total_hands")}
                                            </th>
                                            <th
                                                className="px-6 py-4 text-right text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
                                                onClick={() => toggleSort("net_profit")}
                                            >
                                                Net Profit{sortArrow("net_profit")}
                                            </th>
                                            <th
                                                className="px-6 py-4 text-right text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
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
                                                <td className="px-6 py-4 text-gray-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-mono text-sm hover:underline break-all ${styles.brandText}`}>
                                                        {truncateMiddle(p.player_address, 12, 8)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <VipBadge tier={p.vip_tier} rakebackPct={p.rakeback_pct} />
                                                </td>
                                                <td className="px-6 py-4 text-right text-white">{p.total_hands.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={p.net_profit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                                        {formatUsd(p.net_profit)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-300">{formatUsd(p.total_rake_contributed)}</td>
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
                    </div>
                )}

                {!loading && !error && hasElements(players) && (
                    <div className="sm:hidden mt-4 text-center text-gray-400 text-sm">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} players
                    </div>
                )}
            </div>
        </div>
    );
}
