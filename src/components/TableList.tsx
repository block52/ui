import React, { useCallback, useState } from "react";
import { useFindGames, GameWithFormat, treasuryAddress } from "../hooks/game/useFindGames";
import { useDeleteGame } from "../hooks/game/useDeleteGame";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { formatMicroAsUsdc } from "../constants/currency";
import { sortTablesByAvailableSeats } from "../utils/tableSortingUtils";
import { isTournamentFormat, formatGameFormatDisplay, formatGameVariantDisplay } from "../utils/gameFormatUtils";
import DeleteTableModal from "./modals/DeleteTableModal";
import { Pagination } from "./common";
import styles from "./TableList.module.css";

const PAGE_SIZE = 20;

/**
 * Format buy-in display based on game format
 * SNG/Tournament: Shows buy-in breakdown (e.g., "$10.00 (9.00 + 1.00)")
 * Cash Game: Shows min-max range
 */
const formatBuyIn = (game: GameWithFormat) => {
    const isTournament = isTournamentFormat(game.gameFormat);
    const minBuyIn = formatMicroAsUsdc(game.minBuyIn, 2);

    if (isTournament) {
        // Calculate tournament fee as 10% of total buy-in
        const totalBuyIn = parseFloat(minBuyIn);
        const fee = totalBuyIn * 0.1;
        const prizePool = totalBuyIn - fee;
        return `$${minBuyIn} (${prizePool.toFixed(2)} + ${fee.toFixed(2)})`;
    }

    const maxBuyIn = formatMicroAsUsdc(game.maxBuyIn, 2);
    return `$${minBuyIn} - $${maxBuyIn}`;
};

/**
 * TableList - Displays available poker tables in a table format
 * Used on the landing page RHS
 * Join buttons open tables in a new tab for better user experience
 */
const TableList: React.FC = () => {
    const { games: rawGames, isLoading, error, refetch } = useFindGames();
    const { deleteGame, isDeleting } = useDeleteGame();
    const { address: cosmosAddress } = useCosmosWallet();
    const [deleteModalGameId, setDeleteModalGameId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [playersSortDir, setPlayersSortDir] = useState<"asc" | "desc" | null>(null);
    const [gameIdSearch, setGameIdSearch] = useState("");
    const [showTreasuryOnly, setShowTreasuryOnly] = useState(!!treasuryAddress);

    const handlePlayersSortClick = useCallback(() => {
        setPlayersSortDir(prev => {
            if (prev === null) return "desc";
            if (prev === "desc") return "asc";
            return null;
        });
        setCurrentPage(1);
    }, []);

    const handleGameIdSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setGameIdSearch(e.target.value);
        setCurrentPage(1);
    }, []);

    // Filter by treasury toggle, game ID search, then sort
    const games = React.useMemo(() => {
        let filtered = rawGames;
        if (showTreasuryOnly && treasuryAddress) {
            filtered = filtered.filter(g => g.creator === treasuryAddress);
        }
        if (gameIdSearch.trim()) {
            filtered = filtered.filter(g => g.gameId.toLowerCase().includes(gameIdSearch.trim().toLowerCase()));
        }
        if (playersSortDir === null) {
            return sortTablesByAvailableSeats(filtered);
        }
        return [...filtered].sort((a, b) => (playersSortDir === "desc" ? b.currentPlayers - a.currentPlayers : a.currentPlayers - b.currentPlayers));
    }, [rawGames, showTreasuryOnly, gameIdSearch, playersSortDir]);

    const pagedGames = React.useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return games.slice(start, start + PAGE_SIZE);
    }, [games, currentPage]);

    // Check if there are any cash games to determine if we should show Stakes column
    const hasCashGames = React.useMemo(() => {
        return games.some(game => !isTournamentFormat(game.gameFormat));
    }, [games]);

    // Use environment variables for club branding
    // Defaults to poker.svg icon for table listings (appropriate for poker context)
    // Clubs can override by setting VITE_CLUB_LOGO and VITE_CLUB_NAME in .env
    const clubLogo = import.meta.env.VITE_CLUB_LOGO || "/poker.svg";
    const clubName = import.meta.env.VITE_CLUB_NAME || "Texas Hodl";

    // Copy to clipboard utility with error handling
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error("Failed to copy to clipboard:", err);
        }
    };

    // Handle delete game
    const handleDeleteGame = useCallback(async () => {
        if (!deleteModalGameId) return;
        const result = await deleteGame(deleteModalGameId);
        if (result) {
            // Refresh the games list after successful deletion
            refetch();
        }
    }, [deleteModalGameId, deleteGame, refetch]);

    // Check if user is the creator of a game
    const isCreator = (game: GameWithFormat) => {
        return cosmosAddress && game.creator && game.creator.toLowerCase() === cosmosAddress.toLowerCase();
    };

    // Check if a game can be deleted (no active players)
    const canDelete = (game: GameWithFormat) => {
        return isCreator(game) && game.currentPlayers === 0;
    };

    if (isLoading) {
        return (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-900 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Available Tables</h2>
                </div>
                <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 mr-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <span className="text-white text-lg">Loading tables...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-900 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Available Tables</h2>
                </div>
                <div className="text-center py-12">
                    <div className="text-red-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <p className="text-gray-300 mb-4">{error.message}</p>
                    <button onClick={refetch} className={`px-4 py-2 rounded-lg text-white transition-all hover:opacity-90 ${styles.actionButton}`}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-900 border-b border-gray-700 flex items-center gap-4">
                <h2 className="text-xl font-bold text-white shrink-0">Available Tables</h2>
                <div className="flex items-center gap-3 ml-auto">
                    {treasuryAddress && (
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <span className="text-sm text-gray-400 select-none">Treasury</span>
                            <button
                                role="switch"
                                aria-checked={showTreasuryOnly}
                                onClick={() => setShowTreasuryOnly(v => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showTreasuryOnly ? "bg-blue-600" : "bg-gray-600"}`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${showTreasuryOnly ? "translate-x-4" : "translate-x-1"}`}
                                />
                            </button>
                        </label>
                    )}
                </div>
                <div className="relative max-w-xs w-full">
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                    </svg>
                    <input
                        type="text"
                        value={gameIdSearch}
                        onChange={handleGameIdSearch}
                        placeholder="Search by game ID..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-900">
                        <tr>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Club</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Table ID</th>
                            {hasCashGames && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Stakes</th>}
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Format</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Variant</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">
                                <button
                                    onClick={handlePlayersSortClick}
                                    className="inline-flex items-center gap-1 hover:text-white transition-colors"
                                    title="Sort by current players"
                                >
                                    Players
                                    <span className="text-xs">{playersSortDir === "desc" ? "▼" : playersSortDir === "asc" ? "▲" : "⇅"}</span>
                                </button>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Buy-In</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Action</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {games.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                                    <div className="mb-4">
                                        <svg className="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="1.5"
                                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                            />
                                        </svg>
                                    </div>
                                    <p className="text-gray-400 mb-1">No tables available</p>
                                    <p className="text-gray-500 text-sm">Create the first table to start playing!</p>
                                </td>
                            </tr>
                        ) : (
                            pagedGames.map((game: GameWithFormat) => {
                                const isTournament = isTournamentFormat(game.gameFormat);
                                return (
                                    <tr key={game.gameId} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <img src={clubLogo} alt={clubName} className="w-6 h-6 object-contain" />
                                                <span className="text-white">{clubName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-gray-300 font-mono text-sm">
                                                    {`${game.gameId.slice(0, 4)}...${game.gameId.slice(-4)}`}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(game.gameId)}
                                                    className="text-gray-400 hover:text-white hover:opacity-90 transition-colors"
                                                    title="Copy game ID"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth="2"
                                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                        {hasCashGames && (
                                            <td className="px-4 py-4 text-center">
                                                {!isTournament ? (
                                                    <span className="text-white font-bold">
                                                        ${formatMicroAsUsdc(game.smallBlind, 2)} / ${formatMicroAsUsdc(game.bigBlind, 2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-white capitalize">{formatGameFormatDisplay(game.gameFormat)}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-white capitalize">{formatGameVariantDisplay(game.gameVariant)}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-white font-semibold">
                                                {game.currentPlayers}/{game.maxPlayers}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-gray-300 font-mono text-sm">{formatBuyIn(game)}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <a
                                                href={`/table/${game.gameId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Join ${formatGameFormatDisplay(game.gameFormat)} table with ${game.currentPlayers} of ${game.maxPlayers} players, blinds $${formatMicroAsUsdc(game.smallBlind, 2)}/$${formatMicroAsUsdc(game.bigBlind, 2)}`}
                                                className={`inline-block px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all hover:opacity-90 ${styles.actionButton}`}
                                            >
                                                {game.currentPlayers === game.maxPlayers ? "Full" : "Join"}
                                            </a>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {canDelete(game) && (
                                                <button
                                                    onClick={() => setDeleteModalGameId(game.gameId)}
                                                    disabled={isDeleting}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
                                                    title="Delete table"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth="2"
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={currentPage} totalItems={games.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />

            {/* Delete Table Modal */}
            <DeleteTableModal
                isOpen={!!deleteModalGameId}
                onClose={() => setDeleteModalGameId(null)}
                onConfirm={handleDeleteGame}
                gameId={deleteModalGameId || ""}
            />
        </div>
    );
};

export default TableList;
