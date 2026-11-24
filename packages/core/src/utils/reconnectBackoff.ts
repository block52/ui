/**
 * Reconnect pacing for the game-state WebSocket (ui#613).
 *
 * Exponential backoff from {@link RECONNECT_BASE_MS}, doubling per attempt and
 * capped at {@link RECONNECT_CAP_MS}, with ±{@link RECONNECT_JITTER} random
 * jitter so a relay restart does not get every client back at the same instant.
 * After {@link RECONNECT_MAX_ATTEMPTS} the provider stops and surfaces the loss;
 * a browser `online` event or the tab becoming visible restarts the count.
 *
 * Pure; `random` is injectable for tests.
 */
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_CAP_MS = 30_000;
export const RECONNECT_MAX_ATTEMPTS = 8;
export const RECONNECT_JITTER = 0.25;

/**
 * Delay before reconnect attempt `attempt` (1-based).
 *
 * @param attempt 1 for the first retry after a drop.
 * @param random a `[0, 1)` source; defaults to Math.random.
 */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
    const step = Math.max(1, Math.floor(attempt));
    const nominal = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** (step - 1));
    const jitter = (random() * 2 - 1) * RECONNECT_JITTER;
    return Math.round(nominal * (1 + jitter));
}
