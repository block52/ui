/**
 * Hook for managing table layout configuration.
 *
 * Measures the ACTUAL parent container (via ref) and passes its dimensions
 * to the geometry engine. Uses useLayoutEffect for synchronous measurement
 * before first paint, and reads ref directly to avoid stale state.
 */

import { useState, useLayoutEffect, useCallback, useMemo, type RefObject } from "react";
import {
    type TableSize,
    type PositionArrays,
    getViewportMode,
    calculateZoom,
    getTableTransform,
    getAllPositions
} from "../../config/stageGeometry";

export interface UseTableLayoutReturn {
    viewportMode: string;
    positions: PositionArrays;
    zoom: number;
    tableTransform: string;
    isLandscape: boolean;
    refreshLayout: () => void;
    containerWidth: number;
    containerHeight: number;
}

export const useTableLayout = (
    tableSize: TableSize,
    containerRef?: RefObject<HTMLDivElement | null>
): UseTableLayoutReturn => {
    const [viewportMode, setViewportMode] = useState(getViewportMode());
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
    // Container dimensions are held in STATE, measured by refreshLayout, rather
    // than read from the ref during render. Reading offsetWidth/offsetHeight in a
    // render body forces the browser to flush pending layout, and this hook
    // renders on every WS frame and every blind-level tick — so an unrelated
    // state change was costing a synchronous reflow.
    //
    // Nothing is lost by not reading during render: every source of a size change
    // already calls refreshLayout — the ResizeObserver on the container below
    // (which covers CSS-driven and parent-driven resizes, soft keyboard, foldable
    // posture), plus window resize, orientationchange and visualViewport.
    const [containerSize, setContainerSize] = useState(() => ({
        width: window.innerWidth,
        height: window.innerHeight
    }));

    const refreshLayout = useCallback(() => {
        setViewportMode(getViewportMode());
        setIsLandscape(window.innerWidth > window.innerHeight);

        const el = containerRef?.current;
        const width = el?.offsetWidth ?? window.innerWidth;
        const height = el?.offsetHeight ?? window.innerHeight;
        // Keep the previous object when the size is unchanged, so a resize event
        // that does not actually change the container re-renders nothing.
        setContainerSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    }, [containerRef]);

    // useLayoutEffect fires synchronously BEFORE the browser paints.
    // This ensures the first visible frame uses the real container dimensions.
    useLayoutEffect(() => {
        refreshLayout();

        const handleResize = () => refreshLayout();
        // orientationchange fires before the browser has updated innerWidth/innerHeight,
        // so we delay slightly to read the post-rotation dimensions.
        const handleOrientationChange = () => setTimeout(refreshLayout, 100);

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleOrientationChange);

        // visualViewport fires for mobile pinch-zoom and browser-chrome show/hide
        // (address bar appearing/disappearing) that window.resize misses.
        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener("resize", handleResize);
            vv.addEventListener("scroll", handleResize);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleOrientationChange);
            if (vv) {
                vv.removeEventListener("resize", handleResize);
                vv.removeEventListener("scroll", handleResize);
            }
        };
    }, [refreshLayout]);

    // ResizeObserver on the container catches size changes that window.resize
    // misses: soft keyboard appearing, browser chrome toggling, foldable hinge
    // state changes (inner ↔ outer screen, half-open posture).
    useLayoutEffect(() => {
        const el = containerRef?.current;
        if (!el) return;

        const observer = new ResizeObserver(() => refreshLayout());
        observer.observe(el);

        return () => observer.disconnect();
    }, [containerRef, refreshLayout]);

    const positions = useMemo(() => getAllPositions(tableSize), [tableSize]);

    const { width: cw, height: ch } = containerSize;

    const zoom = useMemo(() => calculateZoom(tableSize, cw, ch), [tableSize, cw, ch]);
    const tableTransform = useMemo(() => getTableTransform(zoom, tableSize, cw, ch), [zoom, tableSize, cw, ch]);

    // Memoized so the returned object keeps a stable identity: PlayerSeating puts
    // it in a useCallback dep array, and a fresh object per render invalidated
    // that on every frame.
    return useMemo(
        () => ({
            viewportMode,
            positions,
            zoom,
            tableTransform,
            isLandscape,
            refreshLayout,
            containerWidth: cw,
            containerHeight: ch
        }),
        [viewportMode, positions, zoom, tableTransform, isLandscape, refreshLayout, cw, ch]
    );
};
