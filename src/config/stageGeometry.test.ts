import { getSeatPositions, getViewportMode, type TableSize } from "./stageGeometry";

describe("getViewportMode", () => {
    const originalMatchMedia = window.matchMedia;

    const setViewport = (width: number, height: number, coarsePointer: boolean) => {
        Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
        Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: height });
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: query === "(pointer: coarse)" ? coarsePointer : false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn()
        }));
    };

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it("returns mobile-landscape for standard mobile landscape widths", () => {
        setViewport(900, 430, true);
        expect(getViewportMode()).toBe("mobile-landscape");
    });

    it("returns mobile-landscape for compact touch landscape fold-like viewports", () => {
        setViewport(1400, 800, true);
        expect(getViewportMode()).toBe("mobile-landscape");
    });

    it("keeps desktop for compact landscape viewports on non-touch pointers", () => {
        setViewport(1400, 800, false);
        expect(getViewportMode()).toBe("desktop");
    });

    it("returns mobile-portrait for portrait touch devices", () => {
        setViewport(393, 852, true);
        expect(getViewportMode()).toBe("mobile-portrait");
    });

    it("returns mobile-portrait for narrow portrait windows even without a coarse pointer", () => {
        // Fine-pointer environments (narrow desktop windows, viewport-resized
        // automation) must take the same path as a real phone, not "tablet".
        setViewport(393, 852, false);
        expect(getViewportMode()).toBe("mobile-portrait");
    });

    it("keeps tablet for wide portrait windows on non-touch pointers", () => {
        setViewport(900, 1100, false);
        expect(getViewportMode()).toBe("tablet");
    });

    describe("portrait stage geometry", () => {
        const px = (value: string): number => parseFloat(value);
        const sizes: TableSize[] = [2, 4, 6, 9];

        it("lays every table size out as a vertical ring (taller than wide), hero at the bottom", () => {
            setViewport(393, 852, true);
            for (const size of sizes) {
                const seats = getSeatPositions(size);
                const xs = seats.map(p => px(p.left));
                const ys = seats.map(p => px(p.top));
                const width = Math.max(...xs) - Math.min(...xs);
                const height = Math.max(...ys) - Math.min(...ys);
                expect(height).toBeGreaterThan(width);
                // Seat 1 (the hero) is the bottom-most seat.
                expect(ys[0]).toBe(Math.max(...ys));
            }
        });

        it("lays the same sizes out as a horizontal ring in landscape", () => {
            setViewport(900, 430, true);
            // 2-max is excluded: heads-up seats are stacked vertically (hero
            // bottom, villain top) in BOTH orientations, so it has no width.
            for (const size of sizes.filter(s => s !== 2)) {
                const seats = getSeatPositions(size);
                const xs = seats.map(p => px(p.left));
                const ys = seats.map(p => px(p.top));
                expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
            }
        });
    });
});
