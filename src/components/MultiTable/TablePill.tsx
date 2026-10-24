import React from "react";
import { getCardImageUrl } from "../../utils/cardImages";
import type { TableStatus } from "../../context/tableSessions/sessionsModel";

/**
 * One table's pill in the multi-tabling bar (block52/ui#55).
 *  - Shows the table name and the player's two hole cards at that table.
 *  - Glows with an animated ring when it's the player's turn there.
 *  - Highlighted when it is the active (visible) table.
 *  - A ✕ closes the table.
 *  - Press and drag to reorder (the bar owns the drag; the pill just reports
 *    the pointer-down and renders the transform it is given). Alt+←/→ moves
 *    it from the keyboard.
 *
 * Sized for the table header's sub-header row (~26px tall).
 */
export interface TablePillProps {
    id: string;
    name?: string;
    status?: TableStatus;
    isActive: boolean;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    /** Being dragged: lifted look, follows the pointer via `style`. */
    isDragging?: boolean;
    style?: React.CSSProperties;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    /** Keyboard reorder: -1 = one place left, +1 = one place right. */
    onMove?: (delta: -1 | 1) => void;
}

/** A short, human label when the table hasn't reported a name yet. */
const shortId = (id: string): string => (id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

const MiniCard: React.FC<{ card: string }> = ({ card }) => (
    <img
        src={getCardImageUrl(card)}
        alt={card || "card"}
        className="h-5 w-[15px] rounded-[2px] object-cover shadow-sm ring-1 ring-black/40"
        draggable={false}
    />
);

export const TablePill = React.forwardRef<HTMLDivElement, TablePillProps>(
    ({ id, name, status, isActive, onSelect, onClose, isDragging = false, style, onPointerDown, onMove }, ref) => {
        const label = name || shortId(id);
        const cards = status?.holeCards ?? [];
        const isMyTurn = status?.isMyTurn ?? false;

        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                e.preventDefault();
                onMove?.(e.key === "ArrowLeft" ? -1 : 1);
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(id);
            }
        };

        return (
            <div
                ref={ref}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                aria-label={isMyTurn ? `${label} — your turn` : label}
                onClick={() => onSelect(id)}
                onKeyDown={handleKeyDown}
                onPointerDown={onPointerDown}
                title={`${isMyTurn ? `${label} — your turn` : label} (drag to reorder)`}
                style={style}
                className={[
                    "b52-table-pill group relative flex h-[26px] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-lg border pl-1 pr-1.5",
                    isActive ? "border-pink-400/80 bg-slate-700/90" : "border-slate-600/60 bg-slate-800/80 hover:bg-slate-700/80",
                    isMyTurn ? "b52-pill-your-turn" : "",
                    isDragging ? "b52-pill-dragging" : ""
                ].join(" ")}
            >
                {/* Hole cards — two slots; shows card backs until the hand deals. */}
                <div className="flex items-center gap-px">
                    <MiniCard card={cards[0] || "??"} />
                    <MiniCard card={cards[1] || "??"} />
                </div>

                <span className="max-w-[96px] truncate text-[11px] font-semibold leading-none text-slate-100">{label}</span>
                {isMyTurn && <span className="sr-only">Your turn</span>}

                <button
                    type="button"
                    aria-label={`Close ${label}`}
                    onClick={e => {
                        e.stopPropagation();
                        onClose(id);
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-slate-400 opacity-0 transition hover:bg-slate-600 hover:text-white focus:opacity-100 group-hover:opacity-100"
                >
                    ✕
                </button>
            </div>
        );
    }
);

TablePill.displayName = "TablePill";
