import { paginationWindow } from "./paginationWindow";

describe("paginationWindow", () => {
    it("returns nothing when there are no pages", () => {
        expect(paginationWindow(1, 0)).toEqual([]);
    });

    it("lists every page when they fit", () => {
        expect(paginationWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
        expect(paginationWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("collapses both sides around a middle page", () => {
        expect(paginationWindow(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
    });

    it("collapses only the far side near the edges", () => {
        expect(paginationWindow(1, 12)).toEqual([1, 2, "gap", 12]);
        expect(paginationWindow(12, 12)).toEqual([1, "gap", 11, 12]);
        expect(paginationWindow(3, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    });

    it("shows the first pages without a leading gap near the start", () => {
        expect(paginationWindow(2, 12)).toEqual([1, 2, 3, "gap", 12]);
        expect(paginationWindow(4, 12)).toEqual([1, "gap", 3, 4, 5, "gap", 12]);
    });

    it("shows the last pages without a trailing gap near the end", () => {
        expect(paginationWindow(11, 12)).toEqual([1, "gap", 10, 11, 12]);
        expect(paginationWindow(9, 12)).toEqual([1, "gap", 8, 9, 10, "gap", 12]);
        expect(paginationWindow(10, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
    });

    it("lists every page at the boundary where the window just fits", () => {
        expect(paginationWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(paginationWindow(4, 8)).toEqual([1, "gap", 3, 4, 5, "gap", 8]);
    });

    it("widens the window with more siblings", () => {
        expect(paginationWindow(1, 20, 2)).toEqual([1, 2, 3, "gap", 20]);
        expect(paginationWindow(10, 20, 2)).toEqual([1, "gap", 8, 9, 10, 11, 12, "gap", 20]);
    });

    it("handles a single page", () => {
        expect(paginationWindow(1, 1)).toEqual([1]);
    });

    it("clamps an out-of-range current page", () => {
        expect(paginationWindow(99, 12)).toEqual([1, "gap", 11, 12]);
        expect(paginationWindow(-3, 12)).toEqual([1, 2, "gap", 12]);
    });
});
