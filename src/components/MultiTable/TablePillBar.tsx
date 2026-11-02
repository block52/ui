import React, { useCallback, useEffect, useRef, useState } from "react";
import "./MultiTable.css";
import { TablePill } from "./TablePill";
import { MAX_OPEN_TABLES, OpenTable, TableStatus } from "../../context/tableSessions/sessionsModel";
import { isEmpty } from "../../utils/guards";

/**
 * The multi-tabling pill bar (block52/ui#55). A horizontal strip of table pills with
 * a trailing "+" to open another table (up to {@link MAX_OPEN_TABLES}). Presentational
 * only — it is handed the open tables, live status, and callbacks, so it can be unit
 * tested and previewed without the live game providers.
 *
 * Pills can be reordered by press-and-drag: with a mouse the drag starts once the
 * pointer moves a few pixels; on touch the pill must be held first, so a quick
 * swipe still scrolls the strip. While dragging, the pill follows the pointer and
 * the others slide aside to show where it will land; releasing calls `onReorder`.
 */
export interface TablePillBarProps {
    openTables: OpenTable[];
    activeId: string | null;
    statusById: Record<string, TableStatus>;
    canOpenMore: boolean;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onAddTable: () => void;
    /** Move table `id` to position `toIndex` (drag or Alt+←/→). */
    onReorder?: (id: string, toIndex: number) => void;
}

/** Pixels the mouse must travel before a press becomes a drag (a smaller move is a click). */
export const DRAG_START_PX = 5;
/** How long a touch must hold still before the pill lifts for dragging. */
export const TOUCH_HOLD_MS = 250;
/** Touch movement that cancels a pending hold (the user is scrolling the strip). */
const TOUCH_SLOP_PX = 8;

/**
 * Where a dragged pill lands: the number of OTHER pills whose centre is left of
 * the dragged pill's current centre. `centers` are the pills' centres when the
 * drag began; `from` is the dragged pill's index; `dx` how far it has moved.
 */
export const dropIndexFor = (centers: number[], from: number, dx: number): number => {
    const draggedCenter = centers[from] + dx;
    return centers.filter((c, i) => i !== from && c < draggedCenter).length;
};

/** How far a non-dragged pill slides to make room: one dragged-pill step, or none. */
export const shiftFor = (index: number, from: number, to: number, step: number): number => {
    if (from < index && index <= to) return -step;
    if (to <= index && index < from) return step;
    return 0;
};

interface DragSession {
    id: string;
    from: number;
    pointerId: number;
    startX: number;
    isTouch: boolean;
    /** Touch: true once the hold timer fired. Mouse/pen: always true. */
    armed: boolean;
    dragging: boolean;
    centers: number[];
    step: number;
    holdTimer?: ReturnType<typeof setTimeout>;
}

interface DragView {
    id: string;
    from: number;
    to: number;
    dx: number;
    step: number;
}

export const TablePillBar: React.FC<TablePillBarProps> = ({
    openTables,
    activeId,
    statusById,
    canOpenMore,
    onSelect,
    onClose,
    onAddTable,
    onReorder
}) => {
    const pillRefs = useRef(new Map<string, HTMLDivElement>());
    const sessionRef = useRef<DragSession | null>(null);
    const suppressClickRef = useRef(false);
    const [drag, setDrag] = useState<DragView | null>(null);
    const listenersRef = useRef<{ move: (e: PointerEvent) => void; end: (e: PointerEvent) => void; touch: (e: TouchEvent) => void } | null>(null);

    const measure = useCallback(
        (session: DragSession) => {
            const rects = openTables.map(t => pillRefs.current.get(t.id)?.getBoundingClientRect());
            session.centers = rects.map(r => (r ? r.left + r.width / 2 : 0));
            const own = rects[session.from];
            const next = rects[session.from + 1] ?? rects[session.from - 1];
            const gap = own && next ? Math.max(0, next.left > own.left ? next.left - own.right : own.left - next.right) : 6;
            session.step = (own?.width ?? 0) + gap;
        },
        [openTables]
    );

    const stopListening = useCallback(() => {
        const l = listenersRef.current;
        if (l) {
            window.removeEventListener("pointermove", l.move);
            window.removeEventListener("pointerup", l.end);
            window.removeEventListener("pointercancel", l.end);
            window.removeEventListener("touchmove", l.touch);
            listenersRef.current = null;
        }
        const s = sessionRef.current;
        if (s?.holdTimer) clearTimeout(s.holdTimer);
        sessionRef.current = null;
    }, []);

    useEffect(() => stopListening, [stopListening]);

    const startDrag = useCallback(
        (session: DragSession) => {
            session.dragging = true;
            measure(session);
            setDrag({ id: session.id, from: session.from, to: session.from, dx: 0, step: session.step });
        },
        [measure]
    );

    const handlePointerDown = useCallback(
        (id: string, index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
            if (!onReorder || openTables.length < 2) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            stopListening();

            const session: DragSession = {
                id,
                from: index,
                pointerId: e.pointerId,
                startX: e.clientX,
                isTouch: e.pointerType === "touch",
                armed: e.pointerType !== "touch",
                dragging: false,
                centers: [],
                step: 0
            };
            sessionRef.current = session;

            if (session.isTouch) {
                session.holdTimer = setTimeout(() => {
                    session.armed = true;
                    startDrag(session);
                }, TOUCH_HOLD_MS);
            }

            const move = (ev: PointerEvent) => {
                if (ev.pointerId !== session.pointerId) return;
                const dx = ev.clientX - session.startX;
                if (!session.armed) {
                    // Touch moved before the hold completed — it's a scroll, not a drag.
                    if (Math.abs(dx) > TOUCH_SLOP_PX) stopListening();
                    return;
                }
                if (!session.dragging) {
                    if (Math.abs(dx) < DRAG_START_PX) return;
                    startDrag(session);
                }
                ev.preventDefault();
                const to = dropIndexFor(session.centers, session.from, dx);
                setDrag({ id: session.id, from: session.from, to, dx, step: session.step });
            };
            const end = (ev: PointerEvent) => {
                if (ev.pointerId !== session.pointerId) return;
                if (session.dragging) {
                    const dx = ev.clientX - session.startX;
                    const to = ev.type === "pointercancel" ? session.from : dropIndexFor(session.centers, session.from, dx);
                    if (to !== session.from) onReorder(session.id, to);
                    // The release also fires a click on the pill — don't treat a drop as a select.
                    suppressClickRef.current = true;
                    setTimeout(() => {
                        suppressClickRef.current = false;
                    }, 0);
                }
                setDrag(null);
                stopListening();
            };
            // Once a touch drag has lifted, stop the strip from scrolling under the finger.
            const touch = (ev: TouchEvent) => {
                if (session.dragging) ev.preventDefault();
            };

            listenersRef.current = { move, end, touch };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", end);
            window.addEventListener("pointercancel", end);
            window.addEventListener("touchmove", touch, { passive: false });
        },
        [onReorder, openTables.length, startDrag, stopListening]
    );

    const handleSelect = useCallback(
        (id: string) => {
            if (suppressClickRef.current) return;
            onSelect(id);
        },
        [onSelect]
    );

    if (isEmpty(openTables)) return null;

    return (
        <div role="tablist" aria-label="Open tables" className="b52-pill-bar flex items-center gap-1.5 overflow-x-auto">
            {openTables.map((t, index) => {
                const isDragging = drag?.id === t.id;
                const offset = drag ? (isDragging ? drag.dx : shiftFor(index, drag.from, drag.to, drag.step)) : 0;
                return (
                    <TablePill
                        key={t.id}
                        ref={el => {
                            if (el) pillRefs.current.set(t.id, el);
                            else pillRefs.current.delete(t.id);
                        }}
                        id={t.id}
                        name={t.name}
                        status={statusById[t.id]}
                        isActive={t.id === activeId}
                        isDragging={isDragging}
                        style={
                            drag
                                ? {
                                      transform: `translateX(${offset}px)`,
                                      transition: isDragging ? "none" : "transform 150ms ease",
                                      zIndex: isDragging ? 2 : undefined
                                  }
                                : undefined
                        }
                        onSelect={handleSelect}
                        onClose={onClose}
                        onPointerDown={handlePointerDown(t.id, index)}
                        onMove={
                            onReorder
                                ? delta => {
                                      const to = index + delta;
                                      if (to >= 0 && to < openTables.length) onReorder(t.id, to);
                                  }
                                : undefined
                        }
                    />
                );
            })}

            <button
                type="button"
                aria-label="Open another table"
                title={canOpenMore ? "Open another table" : `Up to ${MAX_OPEN_TABLES} tables`}
                onClick={onAddTable}
                disabled={!canOpenMore}
                className={[
                    "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border text-base font-bold leading-none transition-all duration-200",
                    canOpenMore
                        ? "border-slate-600/60 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 hover:text-white"
                        : "cursor-not-allowed border-slate-700/40 bg-slate-800/40 text-slate-600"
                ].join(" ")}
            >
                +
            </button>
        </div>
    );
};
