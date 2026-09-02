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
    // State only used to trigger re-renders on resize — actual values read from ref
    const [, setResizeTick] = useState(0);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

    const refreshLayout = useCallback(() => {
        setViewportMode(getViewportMode());
        setIsLandscape(window.innerWidth > window.innerHeight);
        setResizeTick(t => t + 1); // Force re-render so zoom/transform recalculate from ref
    }, []);

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

    // Read container dimensions DIRECTLY from the ref on every render.
    // This avoids stale state — the ref always has the current DOM value.
    const el = containerRef?.current;
    const cw = el?.offsetWidth ?? window.innerWidth;
    const ch = el?.offsetHeight ?? window.innerHeight;

    const zoom = calculateZoom(tableSize, cw, ch);
    const tableTransform = getTableTransform(zoom, tableSize, cw, ch);

    return {
        viewportMode,
        positions,
        zoom,
        tableTransform,
        isLandscape,
        refreshLayout,
        containerWidth: cw,
        containerHeight: ch
    };
};
