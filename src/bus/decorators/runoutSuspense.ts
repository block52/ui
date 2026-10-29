/**
 * runoutSuspense decorator (ui#873 / ui#874).
 *
 * In a TOURNAMENT (SNG or MTT), every beat of an expanded all-in run-out —
 * hands face up, flop, turn, river, result — gets its own suspense hold
 * ({@link runoutBeatHoldMs}) and is marked `protectedHold`, so the drain's
 * backpressure valve no longer clamps it to SHORTENED_HOLD_MS. That valve was
 * the "bloop": a run-out plus its showdown went over HOLD_CAP_MS on its own, so
 * the bigger the moment, the faster it played.
 *
 * Cash games and every frame that is not a run-out beat are untouched, so
 * normal play keeps its speed. The street holds are `minDisplayMs`, so the
 * board's own deal ack still runs alongside (the wait is the longer of the two).
 *
 * The reduced-motion preference is runtime state, so this is a FACTORY like
 * remoteActionSound: the accessor is injected and the decorator stays pure.
 */
import type { Decorator, Decoration } from "../types";
import { runoutBeatHoldMs } from "../timing";
import { isTournamentFormat } from "../../utils/gameFormatUtils";

export function makeRunoutSuspense(getReducedMotion: () => boolean): Decorator {
    return (item): Partial<Decoration> => {
        if (item.runoutBeat === undefined || item.classified.kind !== "state") {
            return {};
        }
        if (!isTournamentFormat(item.classified.format)) {
            return {};
        }
        return {
            minDisplayMs: runoutBeatHoldMs(item.runoutBeat, getReducedMotion()),
            protectedHold: true
        };
    };
}
