/**
 * Seat hole-card sizing (ui#768). Hold'em's two cards keep their original
 * 60x80 size; Omaha's four are drawn smaller and overlapped so they fit the
 * same 160px seat. Branches on the card COUNT, not the variant, so a Hold'em
 * seat renders exactly as before.
 */

/** Height of the card row the seat layout is built around. */
export const HOLE_CARD_ROW_HEIGHT = 80;

export interface HoleCardLayout {
    width: number;
    height: number;
    /** How far each card after the first tucks under its left neighbour. */
    overlap: number;
}

export const holeCardLayout = (count: number): HoleCardLayout =>
    count <= 2 ? { width: 60, height: HOLE_CARD_ROW_HEIGHT, overlap: 0 } : { width: 48, height: 64, overlap: 16 };

export type WinnerCardHighlight = "lift" | "mute" | undefined;

/**
 * At showdown a winner's cards that made the hand lift and the rest mute. For
 * Omaha that is exactly two of the four (the engine's best five use two hole
 * cards); for Hold'em it is however many of the two played.
 */
export const winnerCardHighlight = (card: string, isWinner: boolean, winnerCards: ReadonlySet<string>): WinnerCardHighlight => {
    if (!isWinner || winnerCards.size === 0) return undefined;
    return winnerCards.has(card) ? "lift" : "mute";
};
