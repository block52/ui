/**
 * Fetch a just-broadcast tx, retrying while the indexer catches up (ui#431).
 *
 * Replaces a fixed 2s sleep before `getTx`: the first attempt is immediate and
 * later attempts back off per {@link GET_TX_RETRY_DELAYS_MS}, so the caller
 * gets the tx as soon as the indexer has it. A failed lookup (usually a 404
 * while the tx is not yet indexed) is retried until the delays run out or the
 * next wait would pass {@link GET_TX_BUDGET_MS}; then it resolves `null`.
 *
 * `sleep` and `now` are injectable for tests.
 */
export const GET_TX_RETRY_DELAYS_MS: readonly number[] = [0, 200, 500, 1000, 2000];
export const GET_TX_BUDGET_MS = 5000;

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function getTxWithBackoff<T>(
    getTx: (hash: string) => Promise<T>,
    hash: string,
    sleep: (ms: number) => Promise<void> = defaultSleep,
    now: () => number = Date.now
): Promise<T | null> {
    const start = now();
    for (const delay of GET_TX_RETRY_DELAYS_MS) {
        if (now() - start + delay > GET_TX_BUDGET_MS) break;
        if (delay > 0) await sleep(delay);
        try {
            return await getTx(hash);
        } catch {
            // Not indexed yet (or a transient REST failure) — try again.
        }
    }
    return null;
}
