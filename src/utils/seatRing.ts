/**
 * The seat ring: which seat is drawn at which UI slot (ui#818).
 *
 * The stage geometry draws seats on one of four spec rings (2, 4, 6 or 9
 * slots, `SEAT_COORDS`). Every consumer — the seat components, chips, the
 * dealer button, the turn and win animations — walks the ring's slots and
 * asks "which seat is here?". This module answers that in one place so they
 * can never disagree (each used to inline the rotation formula).
 *
 * One slot per seat of the table, rotated by `startIndex` so the hero sits at
 * 6 o'clock: `seat = ((slot − startIndex + size) % size) + 1`. Empty seats are
 * always drawn as vacant seats — on a started tournament too, so that late
 * registration and sitting in (poker-vm#2613) need no layout change later.
 * A slot may still be `null` (draw nothing); nothing produces one today.
 *
 * Pure functions of plain inputs so the layout can be tested without React.
 */
import type { TableSize } from "../config/stageGeometry";
import { hasElements } from "./guards";

export interface SeatRing {
    /** The spec ring the slots are drawn on (2 | 4 | 6 | 9): the table's seat count. */
    size: TableSize;
    /** Slot → seat number (1-based), or `null` for a slot that draws nothing. */
    seats: (number | null)[];
}

/** The ring: every seat of the table, rotated by `startIndex` (0 = seat 1 at the bottom). */
export const buildSeatRing = (size: TableSize, startIndex: number): SeatRing => {
    const seats: number[] = [];
    for (let slot = 0; slot < size; slot++) {
        seats.push((((slot - startIndex) % size) + size) % size + 1);
    }
    return { size, seats };
};

/** The seat drawn at a slot, or `null` for an empty slot. */
export const seatAtSlot = (ring: SeatRing, slot: number): number | null => ring.seats[slot] ?? null;

/** The slot a seat is drawn at, or −1 when it is not drawn. */
export const slotOfSeat = (ring: SeatRing, seat: number): number => (hasElements(ring.seats) ? ring.seats.indexOf(seat) : -1);
