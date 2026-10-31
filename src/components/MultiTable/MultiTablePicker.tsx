import React, { useEffect, useMemo } from "react";
import { useFindGames } from "../../hooks/game/useFindGames";
import { formatGameFormatDisplay } from "../../utils/gameFormatUtils";
import { hasElements } from "../../utils/guards";

/**
 * In-place table picker for the multi-tabling workspace (block52/ui#55, PR 2).
 *
 * Lists the available games (via useFindGames) and lets the player open one as
 * a new live table WITHOUT navigating away — navigation would unmount the other
 * live tables and drop their sockets. Tables already open are omitted.
 *
 * Presentational + data only: it reports the chosen table id/name through
 * onPick; the workspace owns openTable/setActive.
 */
export interface MultiTablePickerProps {
    /** Ids already open — excluded from the list so you can't double-open one. */
    openIds: string[];
    onPick: (id: string, name?: string) => void;
    onClose: () => void;
}

export const MultiTablePicker: React.FC<MultiTablePickerProps> = ({ openIds, onPick, onClose }) => {
    const { games, isLoading, error } = useFindGames();

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const available = useMemo(() => games.filter(g => !openIds.includes(g.gameId)), [games, openIds]);

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 pt-20 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Open another table"
            onClick={onClose}
            data-testid="multitable-picker"
        >
            <div
                className="max-h-[70vh] w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900/95 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
                    <span className="text-sm font-bold text-slate-100">Open another table</span>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-700 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="max-h-[calc(70vh-52px)] overflow-y-auto p-2">
                    {isLoading && <div className="px-3 py-6 text-center text-sm text-slate-400">Loading tables…</div>}

                    {error && (
                        <div className="px-3 py-6 text-center text-sm text-red-400" data-testid="multitable-picker-error">
                            {error.message}
                        </div>
                    )}

                    {!isLoading && !error && !hasElements(available) && (
                        <div className="px-3 py-6 text-center text-sm text-slate-400">No other tables available.</div>
                    )}

                    {!isLoading &&
                        !error &&
                        available.map(game => {
                            const label = game.name || `Table ${game.gameId.slice(-5)}`;
                            const format = game.gameFormat === "unknown" ? "" : formatGameFormatDisplay(game.gameFormat);
                            return (
                                <button
                                    key={game.gameId}
                                    type="button"
                                    onClick={() => onPick(game.gameId, game.name)}
                                    className="mb-1 flex w-full items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-left transition hover:border-pink-400/60 hover:bg-slate-700/70"
                                    data-testid={`multitable-picker-game-${game.gameId}`}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-slate-100">{label}</span>
                                        <span className="block text-xs text-slate-400">
                                            {format ? `${format} · ` : ""}
                                            {game.currentPlayers}/{game.maxPlayers} players
                                        </span>
                                    </span>
                                    <span className="ml-2 shrink-0 text-xs font-bold text-pink-300">Open</span>
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};
