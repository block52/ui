/**
 * Animation timing — the one place card-animation durations live (runout plan
 * Phase 4, pulled forward by the hole-card dealing plan,
 * docs/plans/2026_09_20_hole_card_dealing_animation.md).
 *
 * Every duration a decorator budgets an ack with, a render hook schedules a
 * timer from, or a CSS keyframe runs for is defined HERE and nowhere else, so the
 * bus's ack budgets and the screen can never drift apart. The CSS side reads
 * these through the custom properties in {@link ANIMATION_CSS_VARS}, which the
 * table root sets from this file.
 *
 * Framework-free plain TS (bus convention): no React imports.
 */

// ---- Community-card (board) deal ---------------------------------------------

/**
 * Per-card reveal stagger (ms) for a newly-dealt street. Wide enough that the
 * flop's three 3D flips read as a clear one-at-a-time deal rather than landing
 * together.
 */
export const CARD_STAGGER_MS = 200;

/** Widest street: the flop deals 3 cards; turn/river deal 1. */
export const MAX_STREET_CARDS = 3;

/**
 * The board card's drop-in duration — Table.css `.animate-fall` runs for
 * `var(--card-drop-ms)`, i.e. this value. Each staggered card takes this long to
 * finish dropping after its slot reveals.
 */
export const CARD_DROP_MS = 1000;

/** Slack for React render latency + scheduler jitter before an ack fallback fires. */
export const ACK_MARGIN_MS = 500;

/**
 * Board-deal ack budget = last card drops at (stagger × maxCards) + its drop
 * duration + a render/jitter margin = 200 × 3 + 1000 + 500 = 2100ms. If nobody
 * acks, the drain falls back to this bound — worst case is the old fixed-timer
 * behavior.
 */
export const DEAL_CARDS_ACK_TIMEOUT_MS = CARD_STAGGER_MS * MAX_STREET_CARDS + CARD_DROP_MS + ACK_MARGIN_MS;

// ---- Hole-card deal (ui#21) --------------------------------------------------

/** Metronome between consecutive hole-card flights leaving the deck (ms). */
export const HOLE_CARD_STAGGER_MS = 90;

/** One card's flight from the deck to its seat (ms). */
export const HOLE_CARD_FLIGHT_MS = 200;

/** The viewer's face-up flip once the last card has landed (ms). */
export const HOLE_CARD_FLIP_MS = 300;

/** Texas Hold'em: two cards per seat, dealt in two rounds. */
export const HOLE_CARDS_PER_SEAT = 2;

/** Flights in a deal to `seatCount` seats (two rounds, one card per seat each). */
export function holeCardFlightCount(seatCount: number): number {
    return Math.max(0, seatCount) * HOLE_CARDS_PER_SEAT;
}

/**
 * When flight `flightIndex` (0-based, in dealing order) leaves the deck.
 * Flight k goes to seat k mod n, card ⌊k / n⌋ — round 1 to every seat, then round 2.
 */
export function holeCardFlightDepartMs(flightIndex: number): number {
    return flightIndex * HOLE_CARD_STAGGER_MS;
}

/** When flight `flightIndex` lands on its seat. */
export function holeCardFlightLandMs(flightIndex: number): number {
    return holeCardFlightDepartMs(flightIndex) + HOLE_CARD_FLIGHT_MS;
}

/** When the LAST card of a deal to `seatCount` seats lands (0 for an empty deal). */
export function holeCardLastLandMs(seatCount: number): number {
    const flights = holeCardFlightCount(seatCount);
    return flights === 0 ? 0 : holeCardFlightLandMs(flights - 1);
}

/** Whole choreography: every card landed AND the viewer's pair has flipped. */
export function holeCardDealDurationMs(seatCount: number): number {
    return holeCardLastLandMs(seatCount) + HOLE_CARD_FLIP_MS;
}

/**
 * Ack budget for a `dealHoleCards` hint — computed from the ACTUAL seat count so
 * heads-up is not budgeted like 9-max: choreography + the render/jitter margin.
 * If nobody acks (unmounted, disabled, hidden tab) the drain proceeds at this bound.
 */
export function holeCardDealAckTimeoutMs(seatCount: number): number {
    return holeCardDealDurationMs(seatCount) + ACK_MARGIN_MS;
}

// ---- CSS bridge ----------------------------------------------------------------

/**
 * Custom properties the table root sets so stylesheets run the SAME durations
 * the bus budgets with (`.animate-fall`, `.deal-flight`, `.handcard-inner`).
 * Plain strings (bus convention); the React cast lives in utils/cssVars.
 */
export const ANIMATION_CSS_VARS: Readonly<Record<string, string>> = {
    "--card-drop-ms": `${CARD_DROP_MS}ms`,
    "--hole-card-flight-ms": `${HOLE_CARD_FLIGHT_MS}ms`,
    "--hole-card-flip-ms": `${HOLE_CARD_FLIP_MS}ms`
};

// ---- Tournament all-in run-out suspense (ui#873 / ui#874) ---------------------

/**
 * One beat of an all-in run-out, as expanded by `expandFrames`:
 *   - `reveal` — the all-in hands turn face up, no board change;
 *   - `flop` / `turn` / `river` — that street's cards land;
 *   - `result` — the real snapshot: winner, payout, final stacks.
 */
export type RunoutBeat = "reveal" | "flop" | "turn" | "river" | "result";

/** Cards each dealing beat lands on the board. */
const RUNOUT_BEAT_CARDS: Readonly<Record<RunoutBeat, number>> = { reveal: 0, flop: 3, turn: 1, river: 1, result: 0 };

/**
 * How long the board takes to land `cardCount` new cards: the last card starts
 * dropping at stagger × count (useCardAnimations) and takes CARD_DROP_MS to land.
 * 0 for a beat that deals nothing.
 */
export function streetLandMs(cardCount: number): number {
    return cardCount > 0 ? CARD_STAGGER_MS * cardCount + CARD_DROP_MS : 0;
}

/**
 * The deliberate pause AFTER each beat has landed, in a tournament all-in
 * run-out. The river gets the longest pause before the result (the suspense
 * beat); the result stays up long enough to read the winning hand and see the
 * pot move. Tune by eye here — nothing else hard-codes these.
 */
export const RUNOUT_PAUSE_MS: Readonly<Record<RunoutBeat, number>> = {
    reveal: 1000,
    flop: 800,
    turn: 1200,
    river: 1800,
    result: 3000
};

/**
 * With `prefers-reduced-motion` the cards do not animate in (Table.css), so a
 * beat is its pause alone, and the pause is cut by this factor.
 */
export const REDUCED_MOTION_PAUSE_FACTOR = 0.5;

/**
 * How long a tournament run-out beat stays on screen (its `minDisplayMs`): the
 * street's landing time plus its pause. Under reduced motion, the shortened
 * pause only. The bus never shortens these holds for ordinary backpressure
 * (they are planned choreography, not backlog); see GameMessageBus.
 */
export function runoutBeatHoldMs(beat: RunoutBeat, reducedMotion: boolean): number {
    if (reducedMotion) {
        return Math.round(RUNOUT_PAUSE_MS[beat] * REDUCED_MOTION_PAUSE_FACTOR);
    }
    return streetLandMs(RUNOUT_BEAT_CARDS[beat]) + RUNOUT_PAUSE_MS[beat];
}

/** Every beat of the longest run-out (a preflop all-in), in order. */
export const FULL_RUNOUT_BEATS: readonly RunoutBeat[] = ["reveal", "flop", "turn", "river", "result"];

/** The longest a run-out can hold the rendered track (a preflop all-in, full motion). */
export function maxRunoutDurationMs(): number {
    return FULL_RUNOUT_BEATS.reduce((total, beat) => total + runoutBeatHoldMs(beat, false), 0);
}

/**
 * Upper bound on how long the automatic next-hand deal waits for a run-out to
 * finish rendering (useAutoNewHand). The longest run-out plus slack for card
 * acks that time out and render latency — after this the deal goes out
 * whatever the bus says, so a stuck or throttled render can never stop the
 * table.
 */
export const MAX_AUTO_DEAL_DEFER_MS = maxRunoutDurationMs() + 4000;

/** How often the deferred deal re-checks whether the run-out has finished. */
export const AUTO_DEAL_DEFER_POLL_MS = 250;

// ---- Tournament finish (ui#874) -------------------------------------------------

/**
 * After the hand that decides a tournament has been shown (its run-out and
 * result beat are paced by the bus), how long the tournament-winner moment —
 * winner, prize, runner-up — stays up before the results modal may appear.
 */
export const TOURNAMENT_WINNER_MOMENT_MS = 5000;

/**
 * How long a newly-arrived finishing result waits before its modal, so the hand
 * that produced it (winning hand named, pot sliding to the winner) is seen
 * first. Matches the run-out's result beat.
 */
export const FINISH_SHOWDOWN_HOLD_MS = RUNOUT_PAUSE_MS.result;
