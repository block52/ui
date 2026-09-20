import {
    ACK_MARGIN_MS,
    ANIMATION_CSS_VARS,
    CARD_DROP_MS,
    DEAL_CARDS_ACK_TIMEOUT_MS,
    HOLE_CARD_FLIGHT_MS,
    HOLE_CARD_FLIP_MS,
    HOLE_CARD_STAGGER_MS,
    holeCardDealAckTimeoutMs,
    holeCardDealDurationMs,
    holeCardFlightCount,
    holeCardFlightDepartMs,
    holeCardFlightLandMs,
    holeCardLastLandMs
} from "./timing";

describe("timing", () => {
    it("keeps the board-deal ack budget at its established value", () => {
        // 200 × 3 + 1000 + 500 — the value useCardAnimations / communityCardStagger
        // were built against. Changing it is a product decision, not a refactor.
        expect(DEAL_CARDS_ACK_TIMEOUT_MS).toBe(2100);
    });

    describe("hole-card deal", () => {
        it("deals two rounds: one flight per seat per round", () => {
            expect(holeCardFlightCount(0)).toBe(0);
            expect(holeCardFlightCount(2)).toBe(4);
            expect(holeCardFlightCount(9)).toBe(18);
        });

        it("departs flights on the stagger metronome and lands them a flight later", () => {
            expect(holeCardFlightDepartMs(0)).toBe(0);
            expect(holeCardFlightDepartMs(3)).toBe(3 * HOLE_CARD_STAGGER_MS);
            expect(holeCardFlightLandMs(3)).toBe(3 * HOLE_CARD_STAGGER_MS + HOLE_CARD_FLIGHT_MS);
        });

        it("lands the last card of an n-seat deal at (2n − 1) × stagger + flight", () => {
            expect(holeCardLastLandMs(0)).toBe(0);
            expect(holeCardLastLandMs(2)).toBe(3 * HOLE_CARD_STAGGER_MS + HOLE_CARD_FLIGHT_MS);
            expect(holeCardLastLandMs(9)).toBe(17 * HOLE_CARD_STAGGER_MS + HOLE_CARD_FLIGHT_MS);
        });

        it("budgets the ack from the actual seat count: choreography + flip + margin", () => {
            for (const seats of [2, 4, 6, 9]) {
                expect(holeCardDealDurationMs(seats)).toBe(holeCardLastLandMs(seats) + HOLE_CARD_FLIP_MS);
                expect(holeCardDealAckTimeoutMs(seats)).toBe(holeCardDealDurationMs(seats) + ACK_MARGIN_MS);
            }
            // Heads-up is not budgeted like 9-max.
            expect(holeCardDealAckTimeoutMs(2)).toBeLessThan(holeCardDealAckTimeoutMs(9));
        });

        it("keeps a full 9-max deal around two seconds", () => {
            const nineMax = holeCardDealDurationMs(9);
            expect(nineMax).toBeGreaterThan(1500);
            expect(nineMax).toBeLessThan(2500);
        });
    });

    it("exposes the CSS durations as the same numbers the bus budgets with", () => {
        expect(ANIMATION_CSS_VARS["--card-drop-ms"]).toBe(`${CARD_DROP_MS}ms`);
        expect(ANIMATION_CSS_VARS["--hole-card-flight-ms"]).toBe(`${HOLE_CARD_FLIGHT_MS}ms`);
        expect(ANIMATION_CSS_VARS["--hole-card-flip-ms"]).toBe(`${HOLE_CARD_FLIP_MS}ms`);
    });
});
