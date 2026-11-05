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
import { NonPlayerActionType, TexasHoldemRound, type ActionDTO, type PlayerDTO, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { makeTurnId, normalizeTimestamp } from "./timerUtils";
import { hasElements, isNullish, isNumber } from "./guards";
import { hasTournamentStarted } from "./scheduledSng";

/**
 * The chain applies a `timeout` only once block time is strictly past
 * deadline + this grace (pokerchain `TurnTimeoutGraceMs`, turn_timeout.go): a
 * player's action broadcast just before the deadline still has to be included
 * in a block. A call submitted inside the grace is rejected, so an observer
 * waits it out.
 *
 * Mirrors the chain's constant by hand — the SDK does not carry it. If the
 * chain changes its grace, change this with it, or every first call is
 * rejected until someone does.
 */
export const TIMEOUT_INCLUSION_GRACE_MS = 10_000;

/**
 * The chain compares the grace against the time of the block that INCLUDES
 * the call, and CometBFT block time trails wall-clock time by up to one block
 * interval (`timeout_commit = 5s` on pokerchain): a call broadcast at wall
 * time W lands in a block stamped anywhere in [W − 5 s, W]. Waiting one
 * interval past the grace keeps the first call from being refused for a
 * clock the chain has not caught up to yet.
 */
export const TIMEOUT_BLOCK_TIME_MARGIN_MS = 5_000;

/**
 * Observers take turns calling the clock rather than all firing at once: the
 * first in line fires at deadline + grace + margin, the next this much later,
 * and so on. One tx per stalled turn in the normal case; a second caller only
 * steps in when the first is itself gone.
 */
export const CLOCK_CALLER_STAGGER_MS = 5_000;

/**
 * When a turn's clock starts, after its anchor (engine
 * `TurnClockStartAllowanceMs`, ui#944). A move is stamped with its block's
 * time, which on pokerchain's 5s blocks is ~5.4s before anyone can see it, so
 * the clock starts one block interval after the stamp. Without this a player
 * saw ~9s of a 15s pre-flop clock and their own auto-fold fired at that point.
 */
export const TURN_CLOCK_START_ALLOWANCE_MS = 5_000;

/** When the turn's own clock starts counting (epoch ms), from its anchor. */
export const turnClockStartMs = (anchorMs: number): number => anchorMs + TURN_CLOCK_START_ALLOWANCE_MS;

/**
 * When the countdown starts for a turn first seen on this frame (ui#944).
 *
 * A committed frame counts from the chain's clock start. A relay projection of
 * mempool actions (`isOptimistic`) stamps a pending move with the LAST block's
 * time, which can be a full block older than the stamp the chain will give it,
 * so counting from it would cut into the player's clock and fold them early.
 * A turn first seen on a projection counts from the moment it is seen: the
 * player gets the full clock, and the chain's real deadline is no earlier.
 */
export const turnCountdownStartMs = (anchorMs: number, isOptimistic: boolean, nowMs: number): number =>
    isOptimistic ? nowMs : turnClockStartMs(anchorMs);

/**
 * The pre-flop turn clock (poker-vm#2143): 15s to act pre-flop, the table's
 * full `gameOptions.timeout` on the flop, turn and river. Mirrors the engine's
 * `PreflopTimeoutSeconds`; a table already shorter than 15s keeps its own.
 */
export const PREFLOP_TIMEOUT_SECONDS = 15;

/**
 * Seconds a player gets to act in `round` on a table whose clock is
 * `timeoutSeconds` (engine `turnTimeoutSeconds`). The time bank adds on top.
 */
export const turnTimeoutSeconds = (timeoutSeconds: number, round: TexasHoldemRound | null | undefined): number => {
    if (round === TexasHoldemRound.PREFLOP && timeoutSeconds > PREFLOP_TIMEOUT_SECONDS) {
        return PREFLOP_TIMEOUT_SECONDS;
    }
    return timeoutSeconds;
};

/**
 * Absolute deadline (epoch ms) of the current turn, mirroring the engine's
 * `TurnDeadlineMs` exactly: the latest turn-advancing recorded action (every
 * action but `time-bank`, which extends the turn without advancing it) plus
 * the street's clock ({@link turnTimeoutSeconds}: 15s pre-flop, else
 * `gameOptions.timeout` seconds), plus one `timeBankMs` per `time-bank` recorded
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
    if (!isNumber(timeoutSeconds) || timeoutSeconds <= 0) {
        return null;
    }
    if (gameState.round === TexasHoldemRound.END || !(gameState.nextToAct > 0)) {
        return null;
    }
    if (!hasElements(gameState.previousActions)) {
        return null;
    }

    const anchor = turnClockAnchorMs(gameState.previousActions);
    if (isNullish(anchor)) {
        return null;
    }

    return turnClockStartMs(anchor) + turnTimeoutSeconds(timeoutSeconds, gameState.round) * 1000 + timeBankGrantedMs(gameState);
};

/**
 * The turn clock's anchor (epoch ms): the latest recorded action that advanced
 * the turn. A `time-bank` extends the current turn without advancing it, so it
 * never moves the anchor (engine `turnClockAnchor`). `null` when nothing
 * anchors the clock yet.
 */
export const turnClockAnchorMs = (previousActions: readonly ActionDTO[] | null | undefined): number | null => {
    let anchor: number | null = null;
    for (const action of previousActions ?? []) {
        if (action.action === NonPlayerActionType.TIME_BANK) {
            continue;
        }
        const at = normalizeTimestamp(action.timestamp);
        if (isNullish(anchor) || at > anchor) {
            anchor = at;
        }
    }
    return anchor;
};

/**
 * The engine's per-player time-bank state (poker-vm feat/20-time-bank-tiers):
 * what the next use grants and what the latest use granted. Newer than the
 * SDK's PlayerDTO type (1.15.0), so it is read here, in one place, until the
 * SDK release carries `timeBankRemainingMs` / `timeBankLastGrantMs`; then this
 * accessor goes and callers read the fields directly.
 */
type PlayerTimeBank = { timeBankRemainingMs?: number; timeBankLastGrantMs?: number };
const playerTimeBank = (player: PlayerDTO | null | undefined): PlayerTimeBank => (player ?? {}) as PlayerTimeBank;

/**
 * What one use of the time bank grants this player next (ui#19/#20/#944):
 * whatever is left in their bank. It starts at 45s, only the seconds spent come
 * off it (with a one-time 30s safety net), and it refills 5s per orbit. The
 * engine sends it on every table with a time bank; null when the player has none.
 */
export const nextTimeBankMs = (player: PlayerDTO | null | undefined): number | null => {
    return playerTimeBank(player).timeBankRemainingMs ?? null;
};

/**
 * Extra time the time bank has granted the current turn (ui#19/#20): for each
 * `time-bank` after the last turn-advancing action, what that player's use
 * granted (`timeBankLastGrantMs`), mirroring the engine's TurnDeadlineMs. 0
 * when nobody used it this turn.
 *
 * It goes by order, not timestamp (ui#944): every action in a block shares that
 * block's time, so a tap and the move ending the turn can carry the same stamp.
 * A timestamp test counted the tap against the next turn too, leaving the alarm
 * clock stuck on "armed" for a player acting again.
 */
export const timeBankGrantedMs = (gameState: TexasHoldemStateDTO | null | undefined): number => {
    const previousActions = gameState?.previousActions ?? [];
    const grantOf = (address: string): number => {
        const player = gameState?.players?.find(p => p.address?.toLowerCase() === address.toLowerCase());
        return playerTimeBank(player).timeBankLastGrantMs ?? 0;
    };
    let granted = 0;
    for (let i = previousActions.length - 1; i >= 0 && previousActions[i].action === NonPlayerActionType.TIME_BANK; i--) {
        granted += grantOf(previousActions[i].playerId);
    }
    return granted;
};

/**
 * Where the local player stands in the line of observers who may call the
 * clock on the current turn, or `null` when they may not: not seated at this
 * table, the one on the clock, or no dealer button in the snapshot (the chain
 * sets one for every running hand; without it there is no agreed order, so
 * nobody calls rather than everybody).
 *
 * The line runs clockwise from the dealer button, so the button calls first
 * (rank 0). When the button is the stalled player, the next seat after it is
 * first — the fallback the epic (poker-vm#2698) asks for — and every further
 * seat lines up behind, so the table never deadlocks on who should call.
 */
export const clockCallerRank = (gameState: TexasHoldemStateDTO | null | undefined, myAddress: string | null | undefined): number | null => {
    if (!gameState || !myAddress || !hasElements(gameState.players) || isNullish(gameState.dealer)) {
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
    const button = gameState.dealer;
    const ring = Math.max(gameState.gameOptions.maxPlayers, button, ...seats);
    const distance = (seat: number): number => (((seat - button) % ring) + ring) % ring;

    const line = gameState.players.filter(player => player.seat !== gameState.nextToAct).sort((a, b) => distance(a.seat) - distance(b.seat));
    return line.findIndex(player => player.seat === mine.seat);
};

/**
 * When THIS client should call the clock on the current turn (epoch ms), or
 * `null` when it should not: no turn on the clock, or the local player is not
 * in the line (see {@link clockCallerRank}).
 *
 *   deadline + inclusion grace + block-time margin + rank × stagger
 */
export const clockCallDueAtMs = (gameState: TexasHoldemStateDTO | null | undefined, myAddress: string | null | undefined): number | null => {
    const deadline = turnDeadlineMs(gameState);
    if (isNullish(deadline)) {
        return null;
    }
    const rank = clockCallerRank(gameState, myAddress);
    if (isNullish(rank)) {
        return null;
    }
    return deadline + TIMEOUT_INCLUSION_GRACE_MS + TIMEOUT_BLOCK_TIME_MARGIN_MS + rank * CLOCK_CALLER_STAGGER_MS;
};

/**
 * One chance to call the clock: a turn this client may call, and when.
 *
 * `key` identifies the TURN (hand, seat to act, actions so far), not the due
 * time. The due time is derived from action timestamps, which a later frame
 * of the same turn may re-stamp (the #561 class; a projection replaced by the
 * committed record). Latching on the key keeps that from reading as a second
 * opportunity: the hook calls once per turn, however the due time moves.
 */
export interface ClockCallOpportunity {
    key: string;
    /** The seat on the clock. */
    seat: number;
    dueAtMs: number;
}

/**
 * The current opportunity for the local player, or `null` when there is none
 * (see {@link clockCallDueAtMs}). A tournament that has not started has no
 * turn to call even though its join actions anchor a deadline: the lobby is
 * waiting for players, not for the seat the engine names to act (ui#898).
 */
export const clockCallOpportunity = (
    gameState: TexasHoldemStateDTO | null | undefined,
    myAddress: string | null | undefined,
    isTournament: boolean
): ClockCallOpportunity | null => {
    if (isTournament && !hasTournamentStarted(gameState)) {
        return null;
    }
    const dueAtMs = clockCallDueAtMs(gameState, myAddress);
    if (isNullish(dueAtMs) || !gameState) {
        return null;
    }
    return {
        key: `${gameState.handNumber}:${makeTurnId(gameState.nextToAct, gameState.previousActions.length)}`,
        seat: gameState.nextToAct,
        dueAtMs
    };
};

/**
 * Which clock a turn is running on, for display (ui#19).
 *
 * The chain's deadline is `anchor + turn clock + bank granted`, so tapping the
 * time bank never costs the player any of their own time. The screen shows it
 * the same way: the turn clock keeps counting down (the bank is "armed"), and
 * only when it reaches zero does the countdown switch to the bank.
 *
 *   - `base`: the turn clock is running; `remainingMs` / `totalMs` are its own.
 *   - `bank`: the turn clock is spent and a bank was granted this turn;
 *     `remainingMs` / `totalMs` are the bank's.
 *
 * `remainingMs` is clamped at 0, so an expired turn reads as a spent bank (or
 * a spent turn clock when no bank was used).
 */
export interface TurnClockPhase {
    phase: "base" | "bank";
    remainingMs: number;
    totalMs: number;
}

export const turnClockPhase = (args: { nowMs: number; anchorMs: number; baseMs: number; bankGrantedMs: number }): TurnClockPhase => {
    const baseLeft = args.anchorMs + args.baseMs - args.nowMs;
    if (baseLeft > 0 || args.bankGrantedMs <= 0) {
        return { phase: "base", remainingMs: Math.min(args.baseMs, Math.max(0, baseLeft)), totalMs: args.baseMs };
    }
    return { phase: "bank", remainingMs: Math.max(0, baseLeft + args.bankGrantedMs), totalMs: args.bankGrantedMs };
};
