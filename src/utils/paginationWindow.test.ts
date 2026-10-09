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

    it("clamps an out-of-range current page", () => {
        expect(paginationWindow(99, 12)).toEqual([1, "gap", 11, 12]);
        expect(paginationWindow(-3, 12)).toEqual([1, 2, "gap", 12]);
    });
});
