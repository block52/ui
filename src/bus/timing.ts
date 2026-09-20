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
