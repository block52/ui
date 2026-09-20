import { render, screen } from "@testing-library/react";
import DealingLayer, { seatToPositionIndex } from "./DealingLayer";
import { useHoleCardDealContext } from "../../../context/HoleCardDealContext";
import { buildFlights, type HoleCardDealState } from "../../../hooks/animations/useHoleCardDeal";
import { getAllPositions, positionDelta } from "../../../config/stageGeometry";
import { HOLE_CARD_STAGGER_MS } from "../../../bus/timing";

jest.mock("../../../context/HoleCardDealContext");

const mockUseHoleCardDealContext = useHoleCardDealContext as jest.MockedFunction<typeof useHoleCardDealContext>;

function setDealState(over: Partial<HoleCardDealState>) {
    const flights = over.flights ?? [];
    mockUseHoleCardDealContext.mockReturnValue({
        flights,
        landedCount: 0,
        pendingSeats: new Set<number>(),
        viewerRevealed: true,
        isDealing: flights.length > 0,
        isDealt: () => true,
        ...over
    });
}

const positions = getAllPositions(9);

describe("seatToPositionIndex", () => {
    it("is the inverse of PlayerSeating's rotation formula", () => {
        const tableSize = 9;
        for (let startIndex = 0; startIndex < tableSize; startIndex++) {
            for (let seat = 1; seat <= tableSize; seat++) {
                const positionIndex = seatToPositionIndex(seat, startIndex, tableSize);
                const seatBack = ((positionIndex - startIndex + tableSize) % tableSize) + 1;
                expect(seatBack).toBe(seat);
            }
        }
    });
});

describe("DealingLayer", () => {
    it("renders nothing while no deal is running", () => {
        setDealState({ flights: [] });
        const { container } = render(<DealingLayer positions={positions} tableSize={9} startIndex={0} cardBackStyle="default" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders one flight per card, delayed on the stagger, aimed from the deck at the seat's slot", () => {
        setDealState({ flights: buildFlights([7, 1, 3]) });
        render(<DealingLayer positions={positions} tableSize={9} startIndex={0} cardBackStyle="default" />);

        const layer = screen.getByTestId("deal-layer");
        expect(layer.style.getPropertyValue("--deal-origin-x")).toBe(positions.deck.left);
        expect(layer.style.getPropertyValue("--deal-origin-y")).toBe(positions.deck.top);

        const flights = layer.querySelectorAll<HTMLImageElement>(".deal-flight");
        expect(flights).toHaveLength(6);
        // Departure order: round 1 to 7, 1, 3 then round 2 to 7, 1, 3.
        expect(Array.from(flights).map(f => `${f.dataset.seat}:${f.dataset.card}`)).toEqual(["7:0", "1:0", "3:0", "7:1", "1:1", "3:1"]);
        expect(flights[3].style.getPropertyValue("--deal-delay")).toBe(`${3 * HOLE_CARD_STAGGER_MS}ms`);

        // Seat 1 at startIndex 0 is position 0; its first card is that slot's first centre.
        const expected = positionDelta(positions.deck, positions.holeCards[0].first);
        expect(flights[1].style.getPropertyValue("--deal-dx")).toBe(`${expected.dx}px`);
        expect(flights[1].style.getPropertyValue("--deal-dy")).toBe(`${expected.dy}px`);
        // Its second card aims at the second centre.
        const expectedSecond = positionDelta(positions.deck, positions.holeCards[0].second);
        expect(flights[4].style.getPropertyValue("--deal-dx")).toBe(`${expectedSecond.dx}px`);
    });

    it("maps seats through the table rotation like the dealer button does", () => {
        setDealState({ flights: buildFlights([1]) });
        const startIndex = 3;
        render(<DealingLayer positions={positions} tableSize={9} startIndex={startIndex} cardBackStyle="default" />);
        const flight = screen.getByTestId("deal-layer").querySelector<HTMLImageElement>(".deal-flight")!;
        const slot = positions.holeCards[seatToPositionIndex(1, startIndex, 9)];
        const expected = positionDelta(positions.deck, slot.first);
        expect(flight.style.getPropertyValue("--deal-dx")).toBe(`${expected.dx}px`);
        expect(flight.style.getPropertyValue("--deal-dy")).toBe(`${expected.dy}px`);
    });

    it("drops flights as they land — the seat draws them from then on", () => {
        setDealState({ flights: buildFlights([7, 1, 3]), landedCount: 4 });
        render(<DealingLayer positions={positions} tableSize={9} startIndex={0} cardBackStyle="default" />);
        const flights = screen.getByTestId("deal-layer").querySelectorAll<HTMLImageElement>(".deal-flight");
        expect(Array.from(flights).map(f => `${f.dataset.seat}:${f.dataset.card}`)).toEqual(["1:1", "3:1"]);
    });

    it("keeps drawing the deck for the whole deal", () => {
        setDealState({ flights: buildFlights([2, 6]), landedCount: 3 });
        render(<DealingLayer positions={positions} tableSize={6} startIndex={0} cardBackStyle="default" />);
        expect(screen.getByTestId("deal-layer").querySelector(".deal-deck")).not.toBeNull();
    });
});
