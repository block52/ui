import React from "react";
import { HOLE_CARD_ROW_HEIGHT, holeCardLayout, WinnerCardHighlight } from "../../../utils/holeCardLayout";

export interface HoleCardImage {
    key: string;
    src: string;
    alt: string;
    highlight?: WinnerCardHighlight;
    className?: string;
    onError?: () => void;
}

/**
 * A seat's hole cards: two for Hold'em, four (smaller, overlapped) for Omaha
 * (ui#768). The row keeps the same height either way so the avatar below it
 * does not move.
 */
export const HoleCardRow: React.FC<{ cards: HoleCardImage[] }> = ({ cards }) => {
    const { width, height, overlap } = holeCardLayout(cards.length);
    return (
        <>
            {cards.map((card, i) => (
                <img
                    key={card.key}
                    src={card.src}
                    alt={card.alt}
                    width={width}
                    height={height}
                    style={{ marginLeft: i > 0 ? -overlap : 0, marginTop: HOLE_CARD_ROW_HEIGHT - height }}
                    className={`mb-[11px]${card.className ? ` ${card.className}` : ""}${card.highlight === "lift" ? " animate-win-card" : ""}${card.highlight === "mute" ? " opacity-40" : ""}`}
                    onError={card.onError}
                />
            ))}
        </>
    );
};
