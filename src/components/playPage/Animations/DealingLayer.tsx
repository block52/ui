/**
 * DealingLayer — the card backs flying from the deck to each seat (ui#21).
 *
 * Mounted INSIDE the 1000×500 table div (next to the dealer button) so the zoom
 * transform applies uniformly, and positioned purely from `stageGeometry`: the
 * deck origin and each seat's two card slots come from `positions`, mapped
 * through the same rotation formula the dealer button uses. No DOM measurement.
 *
 * Each flight is one <img> driven by a single CSS keyframe (DealingLayer.css)
 * with per-element custom properties for its offset and delay — one render per
 * deal, no per-frame JavaScript, at most 18 elements, gone once the last card
 * has landed. Landed flights are dropped as they land: from that moment the
 * seat component draws its own card backs at the same slot.
 */
import React from "react";
import { useHoleCardDealContext } from "../../../context/HoleCardDealContext";
import { positionDelta, type PositionArrays } from "../../../config/stageGeometry";
import { getCardBackUrl, type CardBackStyle } from "../../../utils/cardImages";
import { cssVars } from "../../../utils/cssVars";
import "./DealingLayer.css";

export interface DealingLayerProps {
    positions: PositionArrays;
    tableSize: number;
    /** Table rotation offset (see PlayerSeating): seat → screen position. */
    startIndex: number;
    cardBackStyle: CardBackStyle;
}

/** Screen position index of a seat under the current rotation (the dealer button's inverse). */
export function seatToPositionIndex(seat: number, startIndex: number, tableSize: number): number {
    return (seat - 1 + startIndex) % tableSize;
}

const DealingLayer: React.FC<DealingLayerProps> = React.memo(({ positions, tableSize, startIndex, cardBackStyle }) => {
    const { flights, landedCount, isDealing } = useHoleCardDealContext();
    if (!isDealing) {
        return null;
    }

    const back = getCardBackUrl(cardBackStyle);
    const deck = positions.deck;

    return (
        <div className="deal-layer" aria-hidden="true" data-testid="deal-layer" style={cssVars({ "--deal-origin-x": deck.left, "--deal-origin-y": deck.top })}>
            <img className="deal-deck" src={back} alt="" />
            {flights.map((flight, flightIndex) => {
                if (flightIndex < landedCount) {
                    return null; // landed: the seat draws it now
                }
                const slot = positions.holeCards[seatToPositionIndex(flight.seat, startIndex, tableSize)];
                if (!slot) {
                    return null; // a seat beyond this table size has no slot to fly to
                }
                const { dx, dy } = positionDelta(deck, flight.cardIndex === 0 ? slot.first : slot.second);
                return (
                    <img
                        key={flight.key}
                        className="deal-flight"
                        src={back}
                        alt=""
                        data-seat={flight.seat}
                        data-card={flight.cardIndex}
                        style={cssVars({ "--deal-dx": `${dx}px`, "--deal-dy": `${dy}px`, "--deal-delay": `${flight.departMs}ms` })}
                    />
                );
            })}
        </div>
    );
});

DealingLayer.displayName = "DealingLayer";

export default DealingLayer;
