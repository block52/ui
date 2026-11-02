import React, { useCallback, useEffect, useRef, useState } from "react";
import { getCardImageUrl } from "../../utils/cardImages";
import type { TableStatus } from "../../context/tableSessions/sessionsModel";

/**
 * A table pulled out of the header into a floating bubble (block52/ui#887).
 *
 * A small circle showing only the player's two hole cards at that table (card
 * backs between hands) — no name on the face; the name is its label/tooltip.
 * It glows on your turn like a pill, sits wherever it was dropped, and:
 *  - click → switch to that table;
 *  - drag → move it (dropping it over the header bar docks it back as a pill).
 *
 * `ghost` renders the same face as a non-interactive preview that follows the
 * pointer while a pill is being pulled out of the bar.
 */
export const BUBBLE_SIZE_PX = 52;
/** Pointer travel before a press on a bubble becomes a drag (a smaller move is a click). */
const BUBBLE_DRAG_PX = 5;

export interface TableBubbleProps {
    id: string;
    name?: string;
    status?: TableStatus;
    isActive: boolean;
    /** Centre of the bubble in viewport pixels. */
    x: number;
    y: number;
    ghost?: boolean;
    onSelect?: (id: string) => void;
    /** Released after a drag at (clientX, clientY): the workspace floats or docks it. */
    onDrop?: (id: string, clientX: number, clientY: number) => void;
}

const shortId = (id: string): string => (id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

/** Clamp a bubble centre so the whole circle stays on screen. */
export const clampToViewport = (x: number, y: number, width: number, height: number): { x: number; y: number } => {
    const r = BUBBLE_SIZE_PX / 2 + 4;
    return {
        x: Math.min(Math.max(x, r), Math.max(r, width - r)),
        y: Math.min(Math.max(y, r), Math.max(r, height - r))
    };
};

export const BubbleFace: React.FC<{ cards: string[] }> = ({ cards }) => (
    <div className="flex items-center justify-center -space-x-1.5">
        {[cards[0] || "??", cards[1] || "??"].map((card, i) => (
            <img
                key={i}
                src={getCardImageUrl(card)}
                alt={card}
                draggable={false}
                className={`h-7 w-[20px] rounded-[2px] object-cover shadow ring-1 ring-black/40 ${i === 0 ? "-rotate-6" : "rotate-6"}`}
            />
        ))}
    </div>
);

export const TableBubble: React.FC<TableBubbleProps> = ({ id, name, status, isActive, x, y, ghost = false, onSelect, onDrop }) => {
    const label = name || shortId(id);
    const isMyTurn = status?.isMyTurn ?? false;
    const cards = status?.holeCards ?? [];

    const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
    const listeners = useRef<{ move: (e: PointerEvent) => void; end: (e: PointerEvent) => void } | null>(null);

    const stop = useCallback(() => {
        const l = listeners.current;
        if (l) {
            window.removeEventListener("pointermove", l.move);
            window.removeEventListener("pointerup", l.end);
            window.removeEventListener("pointercancel", l.end);
            listeners.current = null;
        }
        dragRef.current = null;
    }, []);
    useEffect(() => stop, [stop]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (ghost || (e.pointerType === "mouse" && e.button !== 0)) return;
        stop();
        const session = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false };
        dragRef.current = session;
        const move = (ev: PointerEvent) => {
            if (ev.pointerId !== session.pointerId) return;
            const dx = ev.clientX - session.startX;
            const dy = ev.clientY - session.startY;
            if (!session.dragging && Math.hypot(dx, dy) < BUBBLE_DRAG_PX) return;
            session.dragging = true;
            ev.preventDefault();
            setDragOffset({ dx, dy });
        };
        const end = (ev: PointerEvent) => {
            if (ev.pointerId !== session.pointerId) return;
            if (session.dragging) {
                if (ev.type !== "pointercancel") onDrop?.(id, ev.clientX, ev.clientY);
            } else if (ev.type === "pointerup") {
                onSelect?.(id);
            }
            setDragOffset(null);
            stop();
        };
        listeners.current = { move, end };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(id);
        }
    };

    const cx = x + (dragOffset?.dx ?? 0);
    const cy = y + (dragOffset?.dy ?? 0);

    return (
        <div
            role={ghost ? undefined : "button"}
            tabIndex={ghost ? -1 : 0}
            aria-hidden={ghost || undefined}
            aria-label={ghost ? undefined : `${label}${isMyTurn ? " — your turn" : ""}`}
            aria-pressed={ghost ? undefined : isActive}
            title={ghost ? undefined : `${label}${isMyTurn ? " — your turn" : ""} (drag to move, drop on the bar to dock)`}
            data-testid={ghost ? "table-bubble-ghost" : `table-bubble-${id}`}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            style={{ left: cx, top: cy, width: BUBBLE_SIZE_PX, height: BUBBLE_SIZE_PX }}
            className={[
                "b52-table-bubble fixed flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-full border",
                isActive ? "border-pink-400/90 bg-slate-700/95" : "border-slate-500/70 bg-slate-800/95",
                isMyTurn ? "b52-pill-your-turn" : "",
                ghost ? "pointer-events-none opacity-90" : "cursor-pointer",
                dragOffset || ghost ? "b52-bubble-dragging" : ""
            ].join(" ")}
        >
            <BubbleFace cards={cards} />
        </div>
    );
};
