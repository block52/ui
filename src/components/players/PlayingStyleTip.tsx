import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placeTip, tipOpenAfter, type TipSignal } from "../../utils/infoTip";
import type { PlayingStyleFigure } from "../../utils/playingStyle";

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function useFinePointer(): boolean {
    const [fine, setFine] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const list = window.matchMedia(HOVER_QUERY);
        const apply = () => setFine(list.matches);
        apply();
        if (typeof list.addEventListener !== "function") return;
        list.addEventListener("change", apply);
        return () => list.removeEventListener("change", apply);
    }, []);
    return fine;
}

/** A muted ⓘ beside a playing-style title. Hover or focus on a mouse; tap to toggle on a phone. */
export const PlayingStyleTip: React.FC<{ figure: PlayingStyleFigure }> = ({ figure }) => {
    const fine = useFinePointer();
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const tipId = useId();
    const label = `About ${figure.title}`;

    const apply = useCallback((signal: TipSignal) => setOpen(current => tipOpenAfter(current, signal, fine)), [fine]);

    useLayoutEffect(() => {
        if (!open) return;
        const update = () => {
            const anchor = buttonRef.current?.getBoundingClientRect();
            const bubble = bubbleRef.current;
            if (!anchor || !bubble) return;
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            const width = placeTip(anchor, 0, viewport).width;
            bubble.style.width = `${width}px`;
            setBox(placeTip(anchor, bubble.getBoundingClientRect().height, viewport));
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, figure.explanation]);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") apply("escape");
        };
        const onPointer = (event: PointerEvent) => {
            if (fine) return;
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target)) return;
            if (bubbleRef.current?.contains(target)) return;
            apply("outside");
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer);
        };
    }, [apply, fine, open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className="inline-flex items-center justify-center text-sm leading-none text-gray-500 hover:text-gray-300 focus-visible:text-gray-200"
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? tipId : undefined}
                onMouseEnter={() => apply("hover-in")}
                onMouseLeave={() => apply("hover-out")}
                onFocus={() => apply("focus")}
                onBlur={() => apply("blur")}
                onClick={() => apply("click")}
            >
                <span aria-hidden="true">ⓘ</span>
            </button>
            {open &&
                createPortal(
                    <div
                        ref={bubbleRef}
                        id={tipId}
                        role="tooltip"
                        style={{ top: box.top, left: box.left, width: box.width || undefined }}
                        className="fixed z-50 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-2 text-xs leading-snug text-gray-300 shadow-lg"
                    >
                        <strong className="font-semibold text-white">{figure.name}.</strong> {figure.explanation}
                    </div>,
                    document.body
                )}
        </>
    );
};
