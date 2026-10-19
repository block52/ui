import { buildSeatRing, seatAtSlot, slotOfSeat } from "./seatRing";

describe("buildSeatRing — the rotation formula every consumer used inline", () => {
    it("is seat order from the bottom with no rotation", () => {
        expect(buildSeatRing(4, 0).seats).toEqual([1, 2, 3, 4]);
        expect(buildSeatRing(9, 0).seats).toHaveLength(9);
    });

    it("matches ((slot − startIndex + size) % size) + 1 for every rotation", () => {
        for (const size of [2, 4, 6, 9] as const) {
            for (let startIndex = 0; startIndex < size; startIndex++) {
                const ring = buildSeatRing(size, startIndex);
                for (let slot = 0; slot < size; slot++) {
                    expect(ring.seats[slot]).toBe(((slot - startIndex + size) % size) + 1);
                }
            }
        }
    });

    it("puts seat S at the bottom for startIndex = (size − (S − 1)) % size (the auto-rotation)", () => {
        expect(buildSeatRing(6, (6 - (4 - 1)) % 6).seats[0]).toBe(4);
    });

    it("draws every seat: a table with empty seats keeps its full ring", () => {
        const ring = buildSeatRing(9, 2);
        expect(ring.size).toBe(9);
        expect(ring.seats.filter(seat => seat !== null)).toHaveLength(9);
    });
});

describe("seatAtSlot / slotOfSeat", () => {
    const ring = buildSeatRing(6, 1); // [6, 1, 2, 3, 4, 5]

    it("answer each other", () => {
        expect(seatAtSlot(ring, 0)).toBe(6);
        expect(slotOfSeat(ring, 6)).toBe(0);
        expect(seatAtSlot(ring, 3)).toBe(3);
        expect(slotOfSeat(ring, 3)).toBe(3);
    });

    it("a slot off the ring is null; a seat that is not on it is −1", () => {
        expect(seatAtSlot(ring, 99)).toBeNull();
        expect(slotOfSeat(ring, 7)).toBe(-1);
        expect(slotOfSeat({ size: 2, seats: [] }, 1)).toBe(-1);
    });
});
