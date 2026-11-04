import { isEmpty } from "./guards";

interface Page<T> {
    data: T[];
    pagination: { total: number };
}

/** Largest page the indexer accepts. */
export const INDEXER_MAX_PAGE_SIZE = 1000;

/** Reads every page of an indexer list. Stops on an empty page, so a shrinking total can't loop forever. */
export const fetchAllPages = async <T>(fetchPage: (limit: number, offset: number) => Promise<Page<T>>): Promise<T[]> => {
    const rows: T[] = [];
    for (;;) {
        const page = await fetchPage(INDEXER_MAX_PAGE_SIZE, rows.length);
        rows.push(...page.data);
        if (isEmpty(page.data) || rows.length >= page.pagination.total) return rows;
    }
};

/** Like Promise.all over `items`, with at most `limit` calls running at once. Results keep the items' order. */
export const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};
