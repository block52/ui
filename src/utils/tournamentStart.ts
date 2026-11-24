import { formatCountdown } from "./scheduledSng";

/**
 * The count down to a registering tournament's start ("4:32"), or "Starting…" once
 * the start time has passed and the chain has not run the start yet (it does at
 * the next block).
 */
export const startCountdownText = (startsAtMs: number, nowMs: number): string => (nowMs >= startsAtMs ? "Starting…" : formatCountdown(startsAtMs, nowMs));
