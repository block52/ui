import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { useGameSettings } from "../../context/GameSettingsContext";
import { useAnimationAck } from "./useAnimationAck";
import { DEAL_HOLE_CARDS_KIND } from "../../bus/decorators/holeCardDeal";
import { HOLE_CARD_FLIP_MS, HOLE_CARDS_PER_SEAT, holeCardFlightDepartMs, holeCardFlightLandMs } from "../../bus/timing";
import { hasElements } from "../../utils/guards";
import { prefersReducedMotion } from "../../utils/motion";

/** One card back flying from the deck to a seat. */
export interface HoleCardFlight {
    /** Stable React key: `${seat}:${cardIndex}`. */
    key: string;
    seat: number;
    /** 0 = the seat's first card (round 1), 1 = its second (round 2). */
    cardIndex: 0 | 1;
    /** When this flight leaves the deck, ms after the deal frame committed. */
    departMs: number;
}

export interface HoleCardDealState {
    /** The current deal's flights in departure order; empty when nothing is dealing. */
    flights: HoleCardFlight[];
    /** Flights `[0, landedCount)` have landed and are drawn by their seat, not the layer. */
    landedCount: number;
    /** Seats whose second card is still in the air — they render their placeholder until it lands. */
    pendingSeats: ReadonlySet<number>;
    /** False from the deal frame until the last card lands; the viewer's pair shows its backs meanwhile. */
    viewerRevealed: boolean;
    /** True while a deal choreography is running. */
    isDealing: boolean;
    /** Whether a seat should draw its own cards (its cards are not in flight). */
    isDealt: (seat: number) => boolean;
}

const NO_SEATS: ReadonlySet<number> = new Set();
const NO_FLIGHTS: HoleCardFlight[] = [];

/**
 * Flights for a deal to `seats` (already in dealing order): two rounds, flight
 * k → seat k mod n, card ⌊k / n⌋, departing on the stagger metronome.
 */
export function buildFlights(seats: readonly number[]): HoleCardFlight[] {
    const flights: HoleCardFlight[] = [];
    for (let round = 0; round < HOLE_CARDS_PER_SEAT; round++) {
        const cardIndex: 0 | 1 = round === 0 ? 0 : 1;
        for (let i = 0; i < seats.length; i++) {
            const flightIndex = round * seats.length + i;
            flights.push({ key: `${seats[i]}:${cardIndex}`, seat: seats[i], cardIndex, departMs: holeCardFlightDepartMs(flightIndex) });
        }
    }
    return flights;
}

/**
 * Custom hook to run the hole-card dealing choreography (ui#21).
 *
 * The per-seat twin of {@link useCardAnimations}. Driven by the WS Action Bus: it
 * consumes the committed item's `dealHoleCards` animation hint (from the
 * holeCardDeal decorator — the dealt seats in clockwise order from the button)
 * and exposes the timeline the render layer draws from:
 *
 *   - `flights` — 2 × n card backs, one per (seat, card), each with a departure
 *     time; `DealingLayer` animates them from the deck to the seat's card slot.
 *   - `pendingSeats` / `isDealt(seat)` — a seat draws its placeholder until its
 *     SECOND card lands, then its own cards (backs for opponents).
 *   - `viewerRevealed` — the viewer's pair stays face-down until the last card
 *     of the deal has landed, then flips (Player renders the 3D flip).
 *   - the bus ACK fires when that flip finishes, so the drain holds the next
 *     commit for exactly as long as the deal takes (Phase 5 acks).
 *
 * Any other commit RECONCILES to truth (every seat dealt, viewer revealed,
 * timers cleared). That is also the backpressure path: under pressure the bus
 * abandons acks, the next frame arrives mid-deal, and the cards snap — exactly
 * as the board does. Late mount is instant (nothing is pending).
 *
 * The `dealingAnimation` setting and `prefers-reduced-motion` skip the
 * choreography: the deal frame renders as it always did and the ack fires at
 * once. Both are read when the deal frame commits, so toggling mid-deal never
 * restarts one.
 *
 * @returns the deal state (see {@link HoleCardDealState}); consume through
 *   `useHoleCardDealContext` so the layer and the seats share one instance.
 */
export const useHoleCardDeal = (): HoleCardDealState => {
    const { latestItem } = useGameEventsContext();
    const { dealingAnimation } = useGameSettings();
    const ackDone = useAnimationAck(latestItem?.decoration.animations ?? []);

    const [flights, setFlights] = useState<HoleCardFlight[]>(NO_FLIGHTS);
    const [landedCount, setLandedCount] = useState(0);
    const [pendingSeats, setPendingSeats] = useState<ReadonlySet<number>>(NO_SEATS);
    const [viewerRevealed, setViewerRevealed] = useState(true);

    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Read at deal time, never a dependency: flipping the setting mid-deal must
    // not re-run the effect against the same committed item.
    const enabledRef = useRef(dealingAnimation);
    enabledRef.current = dealingAnimation;

    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    useEffect(() => {
        if (!latestItem) return;

        const hint = latestItem.decoration.animations.find(animation => animation.kind === DEAL_HOLE_CARDS_KIND);
        const seats = hint?.seats;

        // Any commit that is not a deal — including a new hand that has not been
        // dealt yet — snaps to truth. Cheap when nothing was in flight.
        const snapToTruth = () => {
            clearTimers();
            setFlights(NO_FLIGHTS);
            setLandedCount(0);
            setPendingSeats(NO_SEATS);
            setViewerRevealed(true);
        };

        if (!hint || !hasElements(seats)) {
            snapToTruth();
            if (hint?.ackId) {
                ackDone(hint.ackId); // a deal to nobody: nothing to draw, release the drain
            }
            return;
        }

        if (!enabledRef.current || prefersReducedMotion()) {
            snapToTruth();
            if (hint.ackId) {
                ackDone(hint.ackId);
            }
            return;
        }

        clearTimers();
        const dealFlights = buildFlights(seats);
        setFlights(dealFlights);
        setLandedCount(0);
        setPendingSeats(new Set(seats));
        setViewerRevealed(false);

        // Each flight lands a flight-duration after it departs. A seat is dealt
        // when its second card lands; the layer stops drawing landed flights.
        dealFlights.forEach((flight, flightIndex) => {
            timersRef.current.push(
                setTimeout(() => {
                    setLandedCount(flightIndex + 1);
                    if (flight.cardIndex === 1) {
                        setPendingSeats(prev => {
                            const next = new Set(prev);
                            next.delete(flight.seat);
                            return next;
                        });
                    }
                }, holeCardFlightLandMs(flightIndex))
            );
        });

        // The viewer's pair flips once the last card has landed; the ack fires
        // when that flip finishes. If this hook unmounts first the timers are
        // cleared and the bus's ackTimeoutMs takes over.
        const lastLandMs = holeCardFlightLandMs(dealFlights.length - 1);
        timersRef.current.push(setTimeout(() => setViewerRevealed(true), lastLandMs));
        const ackId = hint.ackId;
        timersRef.current.push(
            setTimeout(() => {
                setFlights(NO_FLIGHTS);
                if (ackId) {
                    ackDone(ackId);
                }
            }, lastLandMs + HOLE_CARD_FLIP_MS)
        );
    }, [latestItem, ackDone]);

    // Cleanup on unmount.
    useEffect(() => () => clearTimers(), []);

    const isDealt = useCallback((seat: number) => !pendingSeats.has(seat), [pendingSeats]);

    return useMemo(
        () => ({
            flights,
            landedCount,
            pendingSeats,
            viewerRevealed,
            isDealing: hasElements(flights),
            isDealt
        }),
        [flights, landedCount, pendingSeats, viewerRevealed, isDealt]
    );
};
