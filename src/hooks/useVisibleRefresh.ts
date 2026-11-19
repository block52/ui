import { useEffect, useRef } from "react";

/** Ignore a focus event that arrives with the same visibilitychange within this window. */
export const VISIBLE_REFRESH_COALESCE_MS = 250;

/**
 * Run `onVisible` when the user comes back to the tab: the document becomes
 * visible, or the window regains focus. Hidden visibility changes are ignored.
 * A focus event that arrives with the same visibilitychange is coalesced so
 * the data is not fetched twice. Does not run on mount.
 */
export function useVisibleRefresh(onVisible: () => void): void {
    const onVisibleRef = useRef(onVisible);
    onVisibleRef.current = onVisible;

    useEffect(() => {
        if (typeof document === "undefined" || typeof window === "undefined") return;
        let last = 0;
        const run = () => {
            if (document.visibilityState === "hidden") return;
            const now = Date.now();
            if (now - last < VISIBLE_REFRESH_COALESCE_MS) return;
            last = now;
            onVisibleRef.current();
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") run();
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", run);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("focus", run);
        };
    }, []);
}
