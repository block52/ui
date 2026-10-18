import { buildSeatRing, compactRingSize, compactSeatRing, compactSlots, fullSeatRing, seatAtSlot, shouldCompactSeats, slotOfSeat } from "./seatRing";

describe("fullSeatRing — the rotation formula every consumer used inline", () => {
    it("is seat order from the bottom with no rotation", () => {
        expect(fullSeatRing(4, 0).seats).toEqual([1, 2, 3, 4]);
        expect(fullSeatRing(9, 0).seats).toHaveLength(9);
    });

    it("matches ((slot − startIndex + size) % size) + 1 for every rotation", () => {
        for (const size of [2, 4, 6, 9] as const) {
            for (let startIndex = 0; startIndex < size; startIndex++) {
                const ring = fullSeatRing(size, startIndex);
                for (let slot = 0; slot < size; slot++) {
                    expect(ring.seats[slot]).toBe(((slot - startIndex + size) % size) + 1);
                }
            }
        }
    });

    it("puts seat S at the bottom for startIndex = (size − (S − 1)) % size (the auto-rotation)", () => {
        expect(fullSeatRing(6, (6 - (4 - 1)) % 6).seats[0]).toBe(4);
    });

    it("is not compact and keeps its own size as the colour ring", () => {
        expect(fullSeatRing(9, 3)).toMatchObject({ size: 9, full: 9, compact: false });
    });
});

describe("compactRingSize / compactSlots", () => {
    it("is the smallest spec ring that fits, with three players on the 6-ring", () => {
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(compactRingSize)).toEqual([2, 2, 6, 4, 6, 6, 9, 9, 9]);
    });

    it("spreads the players evenly from the bottom, clockwise", () => {
        expect(compactSlots(2, 2)).toEqual([0, 1]);
        expect(compactSlots(3, 6)).toEqual([0, 2, 4]);
        expect(compactSlots(5, 6)).toEqual([0, 1, 2, 4, 5]);
        expect(compactSlots(7, 9)).toEqual([0, 1, 3, 4, 5, 6, 8]);
        expect(compactSlots(8, 9)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    });

    it("never doubles up a slot", () => {
        for (let count = 2; count <= 9; count++) {
            const slots = compactSlots(count, compactRingSize(count));
            expect(new Set(slots).size).toBe(count);
        }
    });
});

describe("shouldCompactSeats — only a frozen roster with seats to spare", () => {
    it("is true for a started tournament with empty seats", () => {
        expect(shouldCompactSeats({ size: 9, seatedSeats: [2, 7], frozen: true })).toBe(true);
    });

    it("is false before the start (people can still join)", () => {
        expect(shouldCompactSeats({ size: 9, seatedSeats: [2, 7], frozen: false })).toBe(false);
    });

    it("is false for a full table (nothing to drop) or a lone player", () => {
        expect(shouldCompactSeats({ size: 2, seatedSeats: [1, 2], frozen: true })).toBe(false);
        expect(shouldCompactSeats({ size: 9, seatedSeats: [5], frozen: true })).toBe(false);
    });
});

describe("compactSeatRing — the seated players on the smallest ring that fits", () => {
    it("two players on a 9-seat table: hero at the bottom, the other at the top", () => {
        const ring = compactSeatRing(9, [2, 7], 7, true);
        expect(ring).toMatchObject({ size: 2, full: 9, compact: true });
        expect(ring.seats).toEqual([7, 2]);
    });

    it("keeps seat order clockwise from the hero", () => {
        // Hero in seat 5: 5 at the bottom, then 8, then 2 (wrapping), then 3.
        const ring = compactSeatRing(9, [2, 3, 5, 8], 5, true);
        expect(ring.seats).toEqual([5, 8, 2, 3]);
    });

    it("three players make a triangle on the 6-ring", () => {
        const ring = compactSeatRing(9, [1, 4, 9], 1, true);
        expect(ring.size).toBe(6);
        expect(ring.seats).toEqual([1, null, 4, null, 9, null]);
    });

    it("starts from the lowest seat when the hero is not seated or not pinned to the bottom", () => {
        expect(compactSeatRing(9, [3, 6, 8], 0, true).seats).toEqual([3, null, 6, null, 8, null]);
        expect(compactSeatRing(9, [3, 6, 8], 8, false).seats).toEqual([3, null, 6, null, 8, null]);
    });

    it("ignores duplicate seats", () => {
        expect(compactSeatRing(6, [2, 2, 5], 2, true).seats).toEqual([2, 5]);
    });
});

describe("buildSeatRing", () => {
    it("is the full ring for a cash game however many seats are empty", () => {
        const ring = buildSeatRing({ size: 9, startIndex: 0, seatedSeats: [1, 2], heroSeat: 1, seatAtBottom: true, frozen: false });
        expect(ring.compact).toBe(false);
        expect(ring.seats).toHaveLength(9);
    });

    it("is the compact ring once a tournament has started with empty seats", () => {
        const ring = buildSeatRing({ size: 9, startIndex: 0, seatedSeats: [1, 2], heroSeat: 2, seatAtBottom: true, frozen: true });
        expect(ring.compact).toBe(true);
        expect(ring.seats).toEqual([2, 1]);
    });

    it("a full frozen table is the same ring as before", () => {
        const startIndex = (4 - (3 - 1)) % 4;
        const ring = buildSeatRing({ size: 4, startIndex, seatedSeats: [1, 2, 3, 4], heroSeat: 3, seatAtBottom: true, frozen: true });
        expect(ring).toEqual(fullSeatRing(4, startIndex));
    });
});

describe("seatAtSlot / slotOfSeat", () => {
    const ring = compactSeatRing(9, [1, 4, 9], 1, true); // [1, null, 4, null, 9, null]

    it("answer each other", () => {
        expect(seatAtSlot(ring, 2)).toBe(4);
        expect(slotOfSeat(ring, 4)).toBe(2);
    });

    it("an empty slot is null; a seat that is not drawn is −1", () => {
        expect(seatAtSlot(ring, 1)).toBeNull();
        expect(seatAtSlot(ring, 99)).toBeNull();
        expect(slotOfSeat(ring, 7)).toBe(-1);
    });
});
