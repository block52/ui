import { renderHook, act } from "@testing-library/react";
import { useHoleCardDeal, buildFlights } from "./useHoleCardDeal";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { useGameSettings } from "../../context/GameSettingsContext";
import { prefersReducedMotion } from "../../utils/motion";
import { DEFAULT_DECORATION, AnimationHint, GameEvent, GameStreamItem } from "../../bus/types";
import { DEAL_HOLE_CARDS_KIND } from "../../bus/decorators/holeCardDeal";
import { HOLE_CARD_FLIGHT_MS, HOLE_CARD_FLIP_MS, HOLE_CARD_STAGGER_MS, holeCardDealAckTimeoutMs, holeCardFlightLandMs } from "../../bus/timing";

jest.mock("../../context/gameState/GameEventsContext");
jest.mock("../../context/GameSettingsContext");
jest.mock("../../utils/motion");

const mockUseGameEventsContext = useGameEventsContext as jest.MockedFunction<typeof useGameEventsContext>;
const mockUseGameSettings = useGameSettings as jest.MockedFunction<typeof useGameSettings>;
const mockPrefersReducedMotion = prefersReducedMotion as jest.MockedFunction<typeof prefersReducedMotion>;

let ackAnimation: jest.Mock;

function setLatestItem(latestItem: GameStreamItem | null) {
    mockUseGameEventsContext.mockReturnValue({ latestItem, ackAnimation });
}

function setDealingAnimation(enabled: boolean) {
    mockUseGameSettings.mockReturnValue({ dealingAnimation: enabled } as ReturnType<typeof useGameSettings>);
}

let seq = 0;
function makeItem(events: GameEvent[], animations: AnimationHint[] = []): GameStreamItem {
    seq += 1;
    return {
        seq,
        receivedAt: 0,
        kind: "state",
        classified: { kind: "actionAccepted" } as GameStreamItem["classified"],
        events,
        decoration: { ...DEFAULT_DECORATION, animations },
        raw: {},
        synthetic: false
    };
}

function dealHint(seats: number[], ackId?: string): AnimationHint {
    return { kind: DEAL_HOLE_CARDS_KIND, seats, staggerMs: HOLE_CARD_STAGGER_MS, ackId, ackTimeoutMs: ackId ? holeCardDealAckTimeoutMs(seats.length) : undefined };
}

/** A four-seat deal in dealing order (button on 5): 8 flights. */
const SEATS = [7, 1, 3, 5];
const dealItem = (ackId?: string) => makeItem([{ type: "cardsDealt", seats: [1, 3, 5, 7], dealerSeat: 5 }], [dealHint(SEATS, ackId)]);

describe("buildFlights", () => {
    it("deals two rounds — one card per seat in order, then the second — on the stagger metronome", () => {
        const flights = buildFlights([7, 1, 3]);
        expect(flights.map(f => `${f.seat}:${f.cardIndex}`)).toEqual(["7:0", "1:0", "3:0", "7:1", "1:1", "3:1"]);
        expect(flights.map(f => f.departMs)).toEqual([0, 1, 2, 3, 4, 5].map(k => k * HOLE_CARD_STAGGER_MS));
        expect(flights.map(f => f.key)).toEqual(["7:0", "1:0", "3:0", "7:1", "1:1", "3:1"]);
    });

    it("is empty for no seats", () => {
        expect(buildFlights([])).toEqual([]);
    });
});

describe("useHoleCardDeal", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        seq = 0;
        ackAnimation = jest.fn();
        setLatestItem(null);
        setDealingAnimation(true);
        mockPrefersReducedMotion.mockReturnValue(false);
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("starts idle: every seat dealt, viewer revealed, nothing in flight (late mount is instant)", () => {
        const { result } = renderHook(() => useHoleCardDeal());
        expect(result.current.isDealing).toBe(false);
        expect(result.current.flights).toEqual([]);
        expect(result.current.viewerRevealed).toBe(true);
        expect(result.current.isDealt(1)).toBe(true);
        expect(result.current.isDealt(9)).toBe(true);
    });

    it("holds each seat's placeholder until its SECOND card lands, in dealing order", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem());
        rerender();

        expect(result.current.isDealing).toBe(true);
        expect(result.current.flights).toHaveLength(8);
        expect(result.current.viewerRevealed).toBe(false);
        for (const seat of SEATS) {
            expect(result.current.isDealt(seat)).toBe(false);
        }
        expect(result.current.isDealt(2)).toBe(true); // not part of the deal — never held

        // Seat 7's second card is flight 4: lands at 4 × stagger + flight.
        const seat7Lands = holeCardFlightLandMs(4);
        act(() => jest.advanceTimersByTime(seat7Lands - 1));
        expect(result.current.isDealt(7)).toBe(false);
        expect(result.current.landedCount).toBe(4); // the whole first round has landed
        act(() => jest.advanceTimersByTime(1));
        expect(result.current.isDealt(7)).toBe(true);
        expect(result.current.isDealt(1)).toBe(false);
        expect(result.current.landedCount).toBe(5);

        act(() => jest.advanceTimersByTime(HOLE_CARD_STAGGER_MS));
        expect(result.current.isDealt(1)).toBe(true);
        act(() => jest.advanceTimersByTime(HOLE_CARD_STAGGER_MS));
        expect(result.current.isDealt(3)).toBe(true);
        expect(result.current.isDealt(5)).toBe(false);
        act(() => jest.advanceTimersByTime(HOLE_CARD_STAGGER_MS));
        expect(result.current.isDealt(5)).toBe(true);
        expect(result.current.landedCount).toBe(8);
    });

    it("flips the viewer's cards when the last card lands and acks after the flip", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("7:0"));
        rerender();

        const lastLand = holeCardFlightLandMs(7);
        act(() => jest.advanceTimersByTime(lastLand - 1));
        expect(result.current.viewerRevealed).toBe(false);
        act(() => jest.advanceTimersByTime(1));
        expect(result.current.viewerRevealed).toBe(true);
        expect(ackAnimation).not.toHaveBeenCalled();
        expect(result.current.isDealing).toBe(true); // the flip is still playing

        act(() => jest.advanceTimersByTime(HOLE_CARD_FLIP_MS - 1));
        expect(ackAnimation).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(1));
        expect(ackAnimation).toHaveBeenCalledTimes(1);
        expect(ackAnimation).toHaveBeenCalledWith("7:0");
        expect(result.current.isDealing).toBe(false);
        expect(result.current.flights).toEqual([]);

        // Well inside the decorator's budget for four seats.
        expect(lastLand + HOLE_CARD_FLIP_MS).toBeLessThan(holeCardDealAckTimeoutMs(4));
    });

    it("does not leak timers or ack after unmount (the bus timeout is the backstop)", () => {
        const { rerender, unmount } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("9:0"));
        rerender();
        unmount();
        act(() => jest.advanceTimersByTime(10_000));
        expect(ackAnimation).not.toHaveBeenCalled();
    });

    it("snaps to truth on any other commit mid-deal (the backpressure path)", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("3:0"));
        rerender();
        act(() => jest.advanceTimersByTime(HOLE_CARD_FLIGHT_MS));
        expect(result.current.isDealt(5)).toBe(false);

        // A player acted before the choreography finished (acks abandoned under pressure).
        setLatestItem(makeItem([{ type: "playerActed", action: { playerId: "b52x", seat: 7, action: "check", amount: "0", round: "preflop", index: 9, timestamp: 0 } as GameEvent extends { action: infer A } ? A : never }]));
        rerender();
        expect(result.current.isDealing).toBe(false);
        expect(result.current.viewerRevealed).toBe(true);
        for (const seat of SEATS) {
            expect(result.current.isDealt(seat)).toBe(true);
        }
        // The abandoned deal's timers were cleared: no late ack from them.
        act(() => jest.advanceTimersByTime(10_000));
        expect(ackAnimation).not.toHaveBeenCalled();
    });

    it("resets on a new hand that has not been dealt yet", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem());
        rerender();
        setLatestItem(makeItem([{ type: "handStarted", handNumber: 2 }]));
        rerender();
        expect(result.current.isDealing).toBe(false);
        expect(result.current.isDealt(7)).toBe(true);
    });

    it("skips the choreography and acks at once when the setting is off", () => {
        setDealingAnimation(false);
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("4:0"));
        rerender();
        expect(result.current.isDealing).toBe(false);
        expect(result.current.isDealt(7)).toBe(true);
        expect(result.current.viewerRevealed).toBe(true);
        expect(ackAnimation).toHaveBeenCalledWith("4:0");
    });

    it("skips the choreography and acks at once under prefers-reduced-motion", () => {
        mockPrefersReducedMotion.mockReturnValue(true);
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("5:0"));
        rerender();
        expect(result.current.isDealing).toBe(false);
        expect(ackAnimation).toHaveBeenCalledWith("5:0");
    });

    it("does not restart a running deal when the setting flips mid-deal", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(dealItem("6:0"));
        rerender();
        act(() => jest.advanceTimersByTime(holeCardFlightLandMs(4)));
        expect(result.current.isDealt(7)).toBe(true);

        setDealingAnimation(false);
        rerender(); // same committed item, new setting value
        expect(result.current.isDealt(7)).toBe(true); // not reset to pending
        expect(result.current.isDealing).toBe(true);
        expect(ackAnimation).not.toHaveBeenCalled();
    });

    it("acks immediately for a deal hint with no seats", () => {
        const { result, rerender } = renderHook(() => useHoleCardDeal());
        setLatestItem(makeItem([{ type: "cardsDealt", seats: [], dealerSeat: null }], [dealHint([], "8:0")]));
        rerender();
        expect(result.current.isDealing).toBe(false);
        expect(ackAnimation).toHaveBeenCalledWith("8:0");
    });
});
