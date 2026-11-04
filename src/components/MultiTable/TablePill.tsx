import React from "react";
import { getCardImageUrl } from "../../utils/cardImages";
import { truncateMiddle } from "../../utils/stringUtils";
import type { TableStatus } from "../../context/tableSessions/sessionsModel";

/**
 * One table's pill in the multi-tabling bar (block52/ui#55).
 *  - Shows the table name and the player's two hole cards at that table.
 *  - Glows with an animated ring when it's the player's turn there.
 *  - Highlighted when it is the active (visible) table.
 *  - A ✕ closes the table.
 */
export interface TablePillProps {
    id: string;
    name?: string;
    status?: TableStatus;
    isActive: boolean;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
}

/** A short, human label when the table hasn't reported a name yet, e.g. "0x6958…c545" (shared helper, per review). */
const shortId = (id: string): string => (id.length > 10 ? truncateMiddle(id, 6, 4, "…") : id);

const MiniCard: React.FC<{ card: string }> = ({ card }) => (
    <img
        src={getCardImageUrl(card)}
        alt={card || "card"}
        className="h-6 w-[18px] rounded-[2px] object-cover shadow-sm ring-1 ring-black/40"
        draggable={false}
    />
);

export const TablePill: React.FC<TablePillProps> = ({ id, name, status, isActive, onSelect, onClose }) => {
    const label = name || shortId(id);
    const cards = status?.holeCards ?? [];
    const isMyTurn = status?.isMyTurn ?? false;

    return (
        <div
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            title={isMyTurn ? `${label} — your turn` : label}
            className={[
                "b52-table-pill group relative flex cursor-pointer select-none items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all duration-200",
                isActive ? "border-pink-400/80 bg-slate-700/80" : "border-slate-600/60 bg-slate-800/70 hover:bg-slate-700/70",
                isMyTurn ? "b52-pill-your-turn" : ""
            ].join(" ")}
        >
            {/* Hole cards — two slots; shows card backs until the hand deals. */}
            <div className="flex items-center gap-0.5">
                <MiniCard card={cards[0] || "??"} />
                <MiniCard card={cards[1] || "??"} />
            </div>

            <div className="flex flex-col leading-tight">
                <span className="max-w-[88px] truncate text-xs font-semibold text-slate-100">{label}</span>
                {isMyTurn && <span className="text-[10px] font-medium text-pink-300">Your turn</span>}
            </div>

            <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={e => {
                    e.stopPropagation();
                    onClose(id);
                }}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-600 hover:text-white group-hover:opacity-100"
            >
                ✕
            </button>
        </div>
    );
};
