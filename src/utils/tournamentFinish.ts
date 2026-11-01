/**
 * The end of a tournament, as the table shows it (ui#874).
 *
 * When the hand that decides a tournament ends, the engine writes the final
 * placings into `results[]` on the same snapshot that settles the hand. The
 * results modal reads `results[]`, so without a beat in between it covered the
 * table the instant the deciding hand landed. These pure helpers say when a
 * finish has just happened, who placed where, and which moment of the finish is
 * on screen; useTournamentFinishMoment drives the timers around them.
 */
import type { ResultDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { FINISH_SHOWDOWN_HOLD_MS, TOURNAMENT_WINNER_MOMENT_MS } from "../bus/timing";
import { hasElements } from "./guards";

export interface TournamentPlacing {
    place: number;
    address: string;
    /** The finisher's seat, or null when they are no longer in `players[]`. */
    seat: number | null;
    /** Raw payout (USDC micro-units string), "0" for an unpaid place. */
    payout: string;
}

export interface TournamentFinish {
    winner: TournamentPlacing;
    runnerUp: TournamentPlacing | null;
    /** The winner's hand in words from the deciding hand ("Two Pair, Kings and Sevens"), or null. */
    winningHand: string | null;
}

const sameAddress = (a: string | undefined, b: string | undefined): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function placingOf(state: TexasHoldemStateDTO, result: ResultDTO): TournamentPlacing {
    const player = state.players.find(p => sameAddress(p.address, result.playerId));
    return { place: result.place, address: result.playerId, seat: player ? player.seat : null, payout: result.payout };
}

/**
 * The tournament's winner, runner-up and winning hand, once `results[]` holds a
 * 1st place; null while the tournament is still running.
 */
export function tournamentFinishOf(state: TexasHoldemStateDTO | undefined): TournamentFinish | null {
    if (!state || !hasElements(state.results)) {
        return null;
    }
    const first = state.results.find(r => r.place === 1);
    if (!first) {
        return null;
    }
    const second = state.results.find(r => r.place === 2);
    // The deciding pot's winner entry carries the hand in words (filled by the
    // SDK at ingest, poker-vm#2721); a fold-out win has none.
    const handWinner = state.winners.find(w => sameAddress(w.address, first.playerId));
    const winningHand = handWinner?.description ? handWinner.description : null;
    return {
        winner: placingOf(state, first),
        runnerUp: second ? placingOf(state, second) : null,
        winningHand
    };
}

/**
 * Did `next` add a finisher to `results[]` that `prev` did not have? That is a
 * finish happening live — as opposed to opening a table whose results were
 * already there, where the modal should show straight away.
 */
export function hasNewFinisher(prev: TexasHoldemStateDTO | undefined, next: TexasHoldemStateDTO): boolean {
    if (!prev || !hasElements(next.results)) {
        return false;
    }
    const before = new Set((prev.results ?? []).map(r => r.playerId.toLowerCase()));
    return next.results.some(r => !before.has(r.playerId.toLowerCase()));
}

/**
 * Which part of a live finish is on screen:
 *   - `showdown` — the deciding hand: winning hand named, pot moving;
 *   - `winner`   — the tournament-winner moment (only when the tournament is over);
 *   - `done`     — results / busted modals may appear.
 */
export type FinishPhase = "showdown" | "winner" | "done";

export function finishPhaseAt(elapsedMs: number, tournamentOver: boolean): FinishPhase {
    if (elapsedMs < FINISH_SHOWDOWN_HOLD_MS) {
        return "showdown";
    }
    if (tournamentOver && elapsedMs < FINISH_SHOWDOWN_HOLD_MS + TOURNAMENT_WINNER_MOMENT_MS) {
        return "winner";
    }
    return "done";
}

/** When the phase after `elapsedMs` starts, relative to the finish (ms); null once done. */
export function nextFinishPhaseAtMs(elapsedMs: number, tournamentOver: boolean): number | null {
    const phase = finishPhaseAt(elapsedMs, tournamentOver);
    if (phase === "showdown") {
        return FINISH_SHOWDOWN_HOLD_MS;
    }
    if (phase === "winner") {
        return FINISH_SHOWDOWN_HOLD_MS + TOURNAMENT_WINNER_MOMENT_MS;
    }
    return null;
}

/** Results / busted modals wait while the finish is still being shown. */
export function holdsResultModals(phase: FinishPhase | null): boolean {
    return phase === "showdown" || phase === "winner";
}

const PLACE_SUFFIX = ["1st", "2nd", "3rd"];

/** "1st", "2nd", "3rd", then "Nth" (tournament fields here stay well below 21). */
export function ordinalPlace(place: number): string {
    return PLACE_SUFFIX[place - 1] ?? `${place}th`;
}

/** How a finisher is named on the table: by seat, as the winner banner does, else by address. */
export function placingLabel(placing: TournamentPlacing, truncate: (address: string) => string): string {
    return placing.seat !== null ? `Seat ${placing.seat}` : truncate(placing.address);
}

export interface WinnerMomentText {
    headline: string;
    /** "with Two Pair, Kings and Sevens", or null when the deciding pot was not shown down. */
    hand: string | null;
    /** The winner's prize in dollars, or null for an unpaid 1st (a freeroll). */
    prize: string | null;
    /** "Seat 5 finished 2nd · $3.00", or null without a 2nd place. */
    runnerUp: string | null;
}

/**
 * The words of the tournament-winner moment (ui#874). Formatting is injected so
 * this stays a pure, testable mapping.
 */
export function winnerMomentText(finish: TournamentFinish, formatDollars: (micro: string) => string, truncate: (address: string) => string): WinnerMomentText {
    const paid = (payout: string): string | null => (payout !== "0" ? `$${formatDollars(payout)}` : null);
    const runnerUp = finish.runnerUp;
    const runnerUpPrize = runnerUp ? paid(runnerUp.payout) : null;
    return {
        headline: `${placingLabel(finish.winner, truncate)} wins the tournament!`,
        hand: finish.winningHand ? `with ${finish.winningHand}` : null,
        prize: paid(finish.winner.payout),
        runnerUp: runnerUp ? `${placingLabel(runnerUp, truncate)} finished ${ordinalPlace(runnerUp.place)}${runnerUpPrize ? ` · ${runnerUpPrize}` : ""}` : null
    };
}
