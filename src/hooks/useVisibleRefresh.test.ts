import { act, renderHook } from "@testing-library/react";
import { useVisibleRefresh, VISIBLE_REFRESH_COALESCE_MS } from "./useVisibleRefresh";

describe("useVisibleRefresh", () => {
    const refresh = jest.fn();

    beforeEach(() => {
        refresh.mockReset();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        jest.useFakeTimers();
        jest.setSystemTime(1_000_000);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function hook() {
        return renderHook(({ fn }) => useVisibleRefresh(fn), { initialProps: { fn: refresh } });
    }

    it("does not run on mount", () => {
        hook();
        expect(refresh).not.toHaveBeenCalled();
    });

    it("runs when the document becomes visible", () => {
        hook();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(refresh).not.toHaveBeenCalled();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("runs when the window regains focus while visible", () => {
        hook();
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("does not run focus while the document is hidden", () => {
        hook();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(refresh).not.toHaveBeenCalled();
    });

    it("coalesces a focus event that arrives with the same visibilitychange", () => {
        hook();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
            window.dispatchEvent(new Event("focus"));
        });
        expect(refresh).toHaveBeenCalledTimes(1);
        act(() => {
            jest.setSystemTime(1_000_000 + VISIBLE_REFRESH_COALESCE_MS + 1);
            window.dispatchEvent(new Event("focus"));
        });
        expect(refresh).toHaveBeenCalledTimes(2);
    });
});
