import { ActionDTO } from "@block52/poker-vm-sdk";

/** Default timeout in seconds for game creation */
export const DEFAULT_TIMEOUT_SECONDS = 30;

/** Default timeout in milliseconds — used when gameOptions hasn't loaded yet */
const DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_SECONDS * 1000;

/**
 * Get the timeout duration in milliseconds from gameOptions.
 * Timeout is always provided at game creation (currently 300s) but the SDK
 * type marks it optional. Default to 30 000 ms while gameOptions is loading.
 */
export const getTimeoutMs = (timeoutSeconds: number | undefined | null): number => {
    if (!timeoutSeconds) {
        return DEFAULT_TIMEOUT_MS;
    }
    return timeoutSeconds * 1000;
};

/**
 * Convert a timeout in milliseconds back to whole seconds for display.
 */
export const timeoutToSeconds = (timeoutMs: number): number => {
    return Math.floor(timeoutMs / 1000);
};

/**
 * Normalise an ActionDTO timestamp to milliseconds.
 * Server timestamps may arrive as Unix seconds (10-digit) or
 * milliseconds (13-digit). This function detects and converts.
 */
export const normalizeTimestamp = (timestamp: number): number => {
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
};

/**
 * Get the most recent action timestamp from previousActions, normalised to ms.
 * Falls back to Date.now() when the array is empty / undefined.
 */
export const getLatestActionTimestampMs = (previousActions: ActionDTO[] | undefined): number => {
    if (!previousActions || previousActions.length === 0) {
        return Date.now();
    }
    const sorted = [...previousActions].sort((a, b) => b.timestamp - a.timestamp);
    return normalizeTimestamp(sorted[0].timestamp);
};

/**
 * Compute the total timeout (with optional extension) in milliseconds.
 */
export const getTotalTimeoutMs = (baseTimeoutMs: number, hasUsedExtension: boolean): number => {
    return baseTimeoutMs + (hasUsedExtension ? baseTimeoutMs : 0);
};

/**
 * Calculate how many whole seconds remain on a player's turn timer.
 *
 * @param currentTimeMs   Current wall-clock time (Date.now())
 * @param lastActionMs    Normalised timestamp of the most recent action
 * @param baseTimeoutMs   Base timeout in milliseconds
 * @param hasExtension    Whether the player has used their time extension
 * @returns seconds remaining (≥ 0)
 */
export const calcTimeRemaining = (
    currentTimeMs: number,
    lastActionMs: number,
    baseTimeoutMs: number,
    hasExtension: boolean
): number => {
    const elapsed = currentTimeMs - lastActionMs;
    const totalTimeout = getTotalTimeoutMs(baseTimeoutMs, hasExtension);
    const remaining = Math.max(0, totalTimeout - elapsed);
    return Math.ceil(remaining / 1000);
};

/**
 * Calculate the progress percentage (0–100) of elapsed time.
 *
 * @returns percentage elapsed, capped at 100
 */
export const calcProgressPercent = (
    currentTimeMs: number,
    lastActionMs: number,
    baseTimeoutMs: number,
    hasExtension: boolean
): number => {
    const elapsed = currentTimeMs - lastActionMs;
    const totalTimeout = getTotalTimeoutMs(baseTimeoutMs, hasExtension);
    return Math.min((elapsed / totalTimeout) * 100, 100);
};
