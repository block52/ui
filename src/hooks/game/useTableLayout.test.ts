/**
 * Tests for useTableLayout.
 *
 * The hook used to read `offsetWidth`/`offsetHeight` from the container ref in
 * its render body. Reading those forces the browser to flush pending layout, and
 * this hook renders on every WS frame and every blind-level tick — so unrelated
 * state changes were each costing a synchronous reflow. It also returned a fresh
 * object every render, which invalidated PlayerSeating's useCallback.
 */
import { renderHook, act } from "@testing-library/react";
import { useTableLayout } from "./useTableLayout";
import type { RefObject } from "react";

/** Captures the observer callback so tests can drive a resize. */
let resizeCallback: (() => void) | null = null;

class StubResizeObserver {
    constructor(cb: () => void) {
        resizeCallback = cb;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
}

/**
 * A container whose dimension reads are COUNTED, so a forced-layout regression
 * shows up as a number rather than as a vague claim.
 */
function makeContainer(width: number, height: number) {
    const el = document.createElement("div");
    const counts = { reads: 0 };
    let w = width;
    let h = height;

    Object.defineProperty(el, "offsetWidth", {
        get() {
            counts.reads += 1;
            return w;
        }
    });
    Object.defineProperty(el, "offsetHeight", {
        get() {
            counts.reads += 1;
            return h;
        }
    });

    return {
        ref: { current: el } as RefObject<HTMLDivElement | null>,
        counts,
        resizeTo(nextW: number, nextH: number) {
            w = nextW;
            h = nextH;
        }
    };
}

describe("useTableLayout", () => {
    beforeEach(() => {
        resizeCallback = null;
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
    });

    describe("measurement", () => {
        it("reports the container's dimensions", () => {
            const container = makeContainer(1200, 700);
            const { result } = renderHook(() => useTableLayout(6, container.ref));

            expect(result.current.containerWidth).toBe(1200);
            expect(result.current.containerHeight).toBe(700);
        });

        it("falls back to the window when there is no container", () => {
            const { result } = renderHook(() => useTableLayout(6));

            expect(result.current.containerWidth).toBe(window.innerWidth);
            expect(result.current.containerHeight).toBe(window.innerHeight);
        });

        it("picks up a container resize through the ResizeObserver", () => {
            const container = makeContainer(1200, 700);
            const { result } = renderHook(() => useTableLayout(6, container.ref));

            container.resizeTo(800, 600);
            act(() => resizeCallback?.());

            expect(result.current.containerWidth).toBe(800);
            expect(result.current.containerHeight).toBe(600);
        });

        it("produces a zoom and a transform for the measured size", () => {
            const container = makeContainer(1200, 700);
            const { result } = renderHook(() => useTableLayout(6, container.ref));

            expect(typeof result.current.zoom).toBe("number");
            expect(result.current.zoom).toBeGreaterThan(0);
            expect(result.current.tableTransform).toEqual(expect.any(String));
        });
    });

    describe("render cost", () => {
        it("does not touch the DOM on renders it did not cause", () => {
            const container = makeContainer(1200, 700);
            const { rerender } = renderHook(() => useTableLayout(6, container.ref));
            const afterMount = container.counts.reads;

            // Renders driven by something else entirely — a WS frame, the
            // blind-level tick. None of them should force a layout read.
            rerender();
            rerender();
            rerender();

            expect(container.counts.reads).toBe(afterMount);
        });

        it("keeps a stable return identity across those renders", () => {
            const container = makeContainer(1200, 700);
            const { result, rerender } = renderHook(() => useTableLayout(6, container.ref));
            const first = result.current;

            rerender();
            rerender();

            expect(result.current).toBe(first);
        });

        it("does not re-render when a resize event leaves the size unchanged", () => {
            const container = makeContainer(1200, 700);
            const { result } = renderHook(() => useTableLayout(6, container.ref));
            const first = result.current;

            act(() => resizeCallback?.());

            expect(result.current).toBe(first);
        });

        it("produces a new value when the size actually changes", () => {
            const container = makeContainer(1200, 700);
            const { result } = renderHook(() => useTableLayout(6, container.ref));
            const first = result.current;

            container.resizeTo(900, 500);
            act(() => resizeCallback?.());

            expect(result.current).not.toBe(first);
            expect(result.current.containerWidth).toBe(900);
        });
    });
});
