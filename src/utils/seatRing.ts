/**
 * The seat ring: which seat is drawn at which UI slot (ui#818).
 *
 * The stage geometry draws seats on one of four spec rings (2, 4, 6 or 9
 * slots, `SEAT_COORDS`). Every consumer — the seat components, chips, the
 * dealer button, the turn and win animations — walks the ring's slots and
 * asks "which seat is here?". This module answers that in one place so they
 * can never disagree.
 *
 * Two shapes:
 *
 * - **Full ring** — one slot per seat of the table, rotated by `startIndex`
 *   so the hero sits at 6 o'clock: `seat = ((slot − startIndex + size) % size) + 1`.
 *   Empty seats are drawn as vacant seats to join. Cash games always use this.
 *
 * - **Compact ring** — once a tournament-style table has STARTED its roster is
 *   frozen (nobody can join), so empty seats are noise: a 2-player sit-and-go
 *   on a 9-seat table showed seven "open" seats. The seated players are laid
 *   out on the smallest spec ring that fits them, spread evenly, hero still at
 *   the bottom, in seat order clockwise. Seat numbers, colours, the dealer
 *   button and turn order are untouched — only where the seats are drawn.
 *
 * Pure functions of plain inputs so the layout can be tested without React.
 */
import type { TableSize } from "../config/stageGeometry";
import { hasElements } from "./guards";

export interface SeatRing {
    /** The spec ring the slots are drawn on (2 | 4 | 6 | 9). Drives positions and zoom. */
    size: TableSize;
    /** The table's own seat count (its spec ring). Seat colours key on this, never on `size`. */
    full: TableSize;
    /** Slot → seat number (1-based), or `null` for a slot that draws nothing. */
    seats: (number | null)[];
    /** Whether empty seats were dropped (frozen roster). */
    compact: boolean;
}

export interface SeatRingInput {
    /** The table's seat count. */
    size: TableSize;
    /** Full-ring rotation offset (0 = seat 1 at the bottom). */
    startIndex: number;
    /** Seats with a player in them. */
    seatedSeats: number[];
    /** The local player's seat, 0 when not seated. */
    heroSeat: number;
    /** The "seat at bottom" setting: rotate so the hero is at 6 o'clock. */
    seatAtBottom: boolean;
    /** The roster is frozen — a tournament-style table that has started. */
    frozen: boolean;
}

/** The spec rings, smallest first. */
export const RING_SIZES: readonly TableSize[] = [2, 4, 6, 9];

/** The full ring: every seat of the table, rotated by `startIndex`. */
export const fullSeatRing = (size: TableSize, startIndex: number): SeatRing => {
    const seats: number[] = [];
    for (let slot = 0; slot < size; slot++) {
        seats.push((((slot - startIndex) % size) + size) % size + 1);
    }
    return { size, full: size, seats, compact: false };
};

/**
 * The spec ring a compact layout of `count` players is drawn on: the smallest
 * that fits them, except that three players take the 6-ring (6 o'clock plus
 * the two upper corners reads as a triangle; the 4-ring would put the
 * opponents dead level with the hero).
 */
export const compactRingSize = (count: number): TableSize => {
    if (count === 3) return 6;
    return RING_SIZES.find(size => size >= count) ?? 9;
};

/**
 * The slots `count` players occupy on a ring of `size`, spread evenly from
 * slot 0 (6 o'clock) clockwise. Distinct as long as `size >= count`.
 */
export const compactSlots = (count: number, size: TableSize): number[] => {
    const slots: number[] = [];
    for (let i = 0; i < count; i++) {
        slots.push(Math.round((i * size) / count));
    }
    return slots;
};

/**
 * Whether a table draws the compact ring: the roster is frozen, at least two
 * are seated (a layout for one is no layout) and there is an empty seat to
 * drop. A full frozen table is the full ring already.
 */
export const shouldCompactSeats = ({ size, seatedSeats, frozen }: Pick<SeatRingInput, "size" | "seatedSeats" | "frozen">): boolean =>
    frozen && seatedSeats.length >= 2 && seatedSeats.length < size;

/**
 * The compact ring: the seated players in seat order clockwise from the hero
 * (or from the lowest seat when the hero is not seated / not pinned to the
 * bottom), spread evenly over the smallest spec ring that fits them.
 */
export const compactSeatRing = (full: TableSize, seatedSeats: number[], heroSeat: number, seatAtBottom: boolean): SeatRing => {
    const order = [...new Set(seatedSeats)].sort((a, b) => a - b);
    const heroAt = seatAtBottom ? order.indexOf(heroSeat) : -1;
    const fromHero = heroAt > 0 ? [...order.slice(heroAt), ...order.slice(0, heroAt)] : order;

    const size = compactRingSize(fromHero.length);
    const seats: (number | null)[] = new Array<number | null>(size).fill(null);
    compactSlots(fromHero.length, size).forEach((slot, i) => {
        seats[slot] = fromHero[i];
    });
    return { size, full, seats, compact: true };
};

/** The ring for a table: compact when the roster is frozen with seats to spare, else the full ring. */
export const buildSeatRing = (input: SeatRingInput): SeatRing =>
    shouldCompactSeats(input) ? compactSeatRing(input.size, input.seatedSeats, input.heroSeat, input.seatAtBottom) : fullSeatRing(input.size, input.startIndex);

/** The seat drawn at a slot, or `null` for an empty slot. */
export const seatAtSlot = (ring: SeatRing, slot: number): number | null => ring.seats[slot] ?? null;

/** The slot a seat is drawn at, or −1 when it is not drawn. */
export const slotOfSeat = (ring: SeatRing, seat: number): number => (hasElements(ring.seats) ? ring.seats.indexOf(seat) : -1);
