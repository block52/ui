import { CLOSING_BET_FLIGHT_MS, CLOSING_BET_HOLD_MS } from "../../bus/timing";
import { isNullish } from "../../utils/guards";

/**
 * One clock for every seat's closing-bet chips, the pot holdback, and the
 * action label. Each of those reads the same snapshot, so they have to collect
 * on the same tick or the pot and the chips disagree.
 *
 * The first snapshot observed after load is treated as already on screen, so
 * opening a table mid-hand does not replay the last street's bets.
 */

export interface ClosingBetClock {
    key: string;
    /** Which hand this clock is following. A new hand does not replay the previous one. */
    handToken: string;
    at: number;
    collectAt: number | null;
    collected: boolean;
    now: number;
}

const QUIET: ClosingBetClock = {
    key: "",
    handToken: "",
    at: Number.NEGATIVE_INFINITY,
    collectAt: null,
    collected: false,
    now: 0
};

let started = false;
let clock: ClosingBetClock = QUIET;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of listeners) listener();
}

function clearTimer(): void {
    if (isNullish(timer)) return;
    clearTimeout(timer);
    timer = null;
}

/** Schedule the next phase change. Chips stay up for the whole runout. */
function arm(): void {
    clearTimer();
    if (!clock.collected) return;
    if (!isNullish(clock.collectAt)) {
        const left = CLOSING_BET_FLIGHT_MS - (Date.now() - clock.collectAt);
        if (left > 0) timer = setTimeout(tick, left);
        return;
    }
    if (clock.at === Number.NEGATIVE_INFINITY) return;
    const elapsed = Date.now() - clock.at;
    if (elapsed < CLOSING_BET_HOLD_MS) {
        timer = setTimeout(tick, CLOSING_BET_HOLD_MS - elapsed);
        return;
    }
    const flightStart = clock.at + CLOSING_BET_HOLD_MS;
    const left = CLOSING_BET_FLIGHT_MS - (Date.now() - flightStart);
    if (left > 0) timer = setTimeout(tick, left);
}

function tick(): void {
    clock = { ...clock, now: Date.now() };
    emit();
    arm();
}

export function resetClosingClock(): void {
    clearTimer();
    started = false;
    clock = QUIET;
    emit();
}

export function subscribeClosingClock(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getClosingClock(): ClosingBetClock {
    return clock;
}

/**
 * Tell the clock which closing moment is on screen.
 * A new key starts the hold. The same key flipping to collected (the runout's
 * result beat) starts the flight immediately, because the chips were already up.
 */
export function syncClosingClock(key: string, collected: boolean, handToken = ""): void {
    if (!started || clock.handToken !== handToken) {
        started = true;
        clock = { key, handToken, at: Number.NEGATIVE_INFINITY, collectAt: null, collected, now: Date.now() };
        emit();
        return;
    }
    if (clock.key !== key) {
        const now = Date.now();
        clock = { key, handToken, at: key ? now : Number.NEGATIVE_INFINITY, collectAt: null, collected, now };
        emit();
        arm();
        return;
    }
    if (clock.collected === collected) return;
    const now = Date.now();
    clock = {
        ...clock,
        collected,
        handToken,
        now,
        collectAt: collected ? now : null
    };
    emit();
    arm();
}
