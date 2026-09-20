import {
    DECK_ORIGIN,
    TABLE_HEIGHT,
    TABLE_WIDTH,
    getAllPositions,
    getHoleCardSlotPositions,
    getSeatPositions,
    positionDelta,
    type TableSize
} from "./stageGeometry";

const px = (value: string): number => parseFloat(value);

describe("hole-card slot geometry (ui#21)", () => {
    const sizes: TableSize[] = [2, 4, 6, 9];

    it("yields two card centres per seat, in seat order, for every table size", () => {
        for (const size of sizes) {
            const slots = getHoleCardSlotPositions(size);
            expect(slots).toHaveLength(size);
            for (const slot of slots) {
                expect(slot.first.left).toMatch(/px$/);
                expect(slot.second.top).toMatch(/px$/);
            }
        }
    });

    it("places the two cards side by side, symmetric about the seat, above its centre", () => {
        for (const size of sizes) {
            const seats = getSeatPositions(size);
            const slots = getHoleCardSlotPositions(size);
            slots.forEach((slot, i) => {
                const seatX = px(seats[i].left);
                const seatY = px(seats[i].top);
                // 60px cards with a 4px gap: each card centre is 32px off the seat centre.
                expect(px(slot.first.left)).toBeCloseTo(seatX - 32, 0);
                expect(px(slot.second.left)).toBeCloseTo(seatX + 32, 0);
                // Both cards share a row above the seat coordinate.
                expect(px(slot.first.top)).toBe(px(slot.second.top));
                expect(px(slot.first.top)).toBeLessThan(seatY);
            });
        }
    });

    it("keeps the deck on the felt, above the board, at the table's horizontal centre", () => {
        expect(px(DECK_ORIGIN.left)).toBe(TABLE_WIDTH / 2);
        expect(px(DECK_ORIGIN.top)).toBeGreaterThan(0);
        expect(px(DECK_ORIGIN.top)).toBeLessThan(TABLE_HEIGHT / 2);
    });

    it("is bundled into getAllPositions alongside the other per-seat arrays", () => {
        for (const size of sizes) {
            const positions = getAllPositions(size);
            expect(positions.holeCards).toHaveLength(size);
            expect(positions.holeCards).toHaveLength(positions.players.length);
            expect(positions.deck).toEqual(DECK_ORIGIN);
        }
    });

    it("computes the flight vector from the deck to a slot", () => {
        expect(positionDelta({ left: "500px", top: "150px" }, { left: "468px", top: "487.5px" })).toEqual({ dx: -32, dy: 337.5 });
        expect(positionDelta(DECK_ORIGIN, DECK_ORIGIN)).toEqual({ dx: 0, dy: 0 });
    });
});
