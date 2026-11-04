import { fetchAllPages, INDEXER_MAX_PAGE_SIZE, mapWithConcurrency } from "./pagedFetch";

describe("fetchAllPages", () => {
    const pageOf = (data: number[], total: number) => ({ data, pagination: { total } });

    it("reads one page when it holds everything", async () => {
        const fetchPage = jest.fn().mockResolvedValue(pageOf([1, 2], 2));
        await expect(fetchAllPages(fetchPage)).resolves.toEqual([1, 2]);
        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith(INDEXER_MAX_PAGE_SIZE, 0);
    });

    it("keeps reading from where the last page ended", async () => {
        const fetchPage = jest.fn().mockResolvedValueOnce(pageOf([1, 2], 3)).mockResolvedValueOnce(pageOf([3], 3));
        await expect(fetchAllPages(fetchPage)).resolves.toEqual([1, 2, 3]);
        expect(fetchPage).toHaveBeenLastCalledWith(INDEXER_MAX_PAGE_SIZE, 2);
    });

    it("stops on an empty page even if the total says there's more", async () => {
        const fetchPage = jest.fn().mockResolvedValueOnce(pageOf([1], 5)).mockResolvedValueOnce(pageOf([], 5));
        await expect(fetchAllPages(fetchPage)).resolves.toEqual([1]);
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it("handles an empty list", async () => {
        await expect(fetchAllPages(jest.fn().mockResolvedValue(pageOf([], 0)))).resolves.toEqual([]);
    });

    it("passes on a failed page", async () => {
        await expect(fetchAllPages(jest.fn().mockRejectedValue(new Error("down")))).rejects.toThrow("down");
    });
});

describe("mapWithConcurrency", () => {
    it("keeps the items' order, whichever finishes first", async () => {
        const slowFirst = (n: number) => new Promise<number>(resolve => setTimeout(() => resolve(n * 2), n === 1 ? 20 : 0));
        await expect(mapWithConcurrency([1, 2, 3], 2, slowFirst)).resolves.toEqual([2, 4, 6]);
    });

    it("never runs more than the limit at once", async () => {
        let running = 0;
        let peak = 0;
        const track = async (n: number) => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise(resolve => setTimeout(resolve, 1));
            running -= 1;
            return n;
        };
        await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, track);
        expect(peak).toBe(3);
    });

    it("handles no items", async () => {
        const fn = jest.fn();
        await expect(mapWithConcurrency([], 3, fn)).resolves.toEqual([]);
        expect(fn).not.toHaveBeenCalled();
    });

    it("passes on a failure", async () => {
        await expect(mapWithConcurrency([1], 3, () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
    });
});
