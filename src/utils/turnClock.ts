/**
 * The chain's turn clock, as seen by an OBSERVER (ui#819).
 *
 * `usePlayerTimer` counts down the local player's own turn and `useAutoFold`
 * folds them when it hits zero. Neither helps when the player to act has gone
 * away: nobody submits their fold and the table waits on them for ever.
 *
 * The chain accepts a `timeout` action from any seated player (pokerchain#360):
 * the engine re-derives the deadline from committed state and plays the
 * stalled player's forced default (check, else fold; the owed blind in ANTE;
 * muck/show at showdown) AS them, or rejects the action while the turn has
 * time left. The caller never chooses the outcome — they only call the clock.
 *
 * Everything here is a pure function of a state snapshot, so it can be tested
 * without React and so every observer at the table computes the same answer.
 */
import { NonPlayerActionType, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { normalizeTimestamp } from "./timerUtils";
import { hasElements } from "./guards";

/**
 * The chain applies a `timeout` only once block time is strictly past
 * deadline + this grace (pokerchain `TurnTimeoutGraceMs`): a player's action
 * broadcast just before the deadline still has to be included in a block. A
 * call submitted inside the grace is rejected, so an observer waits it out.
 */
export const TIMEOUT_INCLUSION_GRACE_MS = 10_000;

/**
 * Observers take turns calling the clock rather than all firing at once: the
 * first in line fires at deadline + grace, the next this much later, and so on.
 * One tx per stalled turn in the normal case; a second caller only steps in
 * when the first is itself gone.
 */
export const CLOCK_CALLER_STAGGER_MS = 5_000;

/**
 * Absolute deadline (epoch ms) of the current turn, mirroring the engine's
 * `TurnDeadlineMs` exactly: the latest turn-advancing recorded action (every
 * action but `time-bank`, which extends the turn without advancing it) plus
 * `gameOptions.timeout` seconds, plus one `timeBankMs` per `time-bank` recorded
 * for this turn (at or after the anchor).
 *
 * `null` when no turn is on the clock: no action clock configured, hand ended,
 * nobody to act, or no recorded action anchors the clock yet (the first blind
 * of a hand, poker-vm#2525).
 */
export const turnDeadlineMs = (gameState: TexasHoldemStateDTO | null | undefined): number | null => {
    if (!gameState) {
        return null;
    }
    const timeoutSeconds = gameState.gameOptions?.timeout;
    if (typeof timeoutSeconds !== "number" || timeoutSeconds <= 0) {
        return null;
    }
    if (gameState.round === TexasHoldemRound.END || !(gameState.nextToAct > 0)) {
        return null;
    }
    if (!hasElements(gameState.previousActions)) {
        return null;
    }

    let anchor: number | null = null;
    for (const action of gameState.previousActions) {
        if (action.action === NonPlayerActionType.TIME_BANK) {
            continue;
        }
        const at = normalizeTimestamp(action.timestamp);
        if (anchor === null || at > anchor) {
            anchor = at;
        }
    }
    if (anchor === null) {
        return null;
    }

    const timeBankMs = gameState.gameOptions.timeBankMs ?? 0;
    let grants = 0;
    for (const action of gameState.previousActions) {
        if (action.action === NonPlayerActionType.TIME_BANK && normalizeTimestamp(action.timestamp) >= anchor) {
            grants += 1;
        }
    }

    return anchor + timeoutSeconds * 1000 + grants * timeBankMs;
};

/**
 * Where the local player stands in the line of observers who may call the
 * clock on the current turn, or `null` when they may not: not seated at this
 * table, or the one on the clock.
 *
 * The line runs clockwise from the dealer button, so the button calls first
 * (rank 0). When the button is the stalled player, the next seat after it is
 * first — the fallback the epic (poker-vm#2698) asks for — and every further
 * seat lines up behind, so the table never deadlocks on who should call.
 */
export const clockCallerRank = (gameState: TexasHoldemStateDTO | null | undefined, myAddress: string | null | undefined): number | null => {
    if (!gameState || !myAddress || !hasElements(gameState.players)) {
        return null;
    }
    const me = myAddress.toLowerCase();
    const mine = gameState.players.find(player => player.address?.toLowerCase() === me);
    if (!mine || mine.seat === gameState.nextToAct) {
        return null;
    }

    // Clockwise distance from the button. The ring is as wide as the table's
    // highest seat number, so seat (button + 1) is always distance 1 and the
    // seat just before the button is the furthest away.
    const seats = gameState.players.map(player => player.seat);
    const button = gameState.dealer ?? 1;
    const ring = Math.max(gameState.gameOptions?.maxPlayers ?? 0, button, ...seats);
    const distance = (seat: number): number => (((seat - button) % ring) + ring) % ring;

    const line = gameState.players.filter(player => player.seat !== gameState.nextToAct).sort((a, b) => distance(a.seat) - distance(b.seat));
    return line.findIndex(player => player.seat === mine.seat);
};

/**
 * When THIS client should call the clock on the current turn (epoch ms), or
 * `null` when it should not: no turn on the clock, or the local player is not
 * in the line (see {@link clockCallerRank}).
 *
 *   deadline + inclusion grace + rank × stagger
 */
export const clockCallDueAtMs = (gameState: TexasHoldemStateDTO | null | undefined, myAddress: string | null | undefined): number | null => {
    const deadline = turnDeadlineMs(gameState);
    if (deadline === null) {
        return null;
    }
    const rank = clockCallerRank(gameState, myAddress);
    if (rank === null) {
        return null;
    }
    return deadline + TIMEOUT_INCLUSION_GRACE_MS + rank * CLOCK_CALLER_STAGGER_MS;
};
