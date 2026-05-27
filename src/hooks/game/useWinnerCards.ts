import { useMemo } from "react";
import { useWinnerInfo } from "./useWinnerInfo";

/**
 * Returns a Set of card codes (e.g. "AS", "KH") that form the winning hand(s).
 * Used to apply the card-lift animation to the specific cards that won.
 * Returns an empty Set when there is no winner or the backend hasn't sent cards yet.
 */
export const useWinnerCards = (): Set<string> => {
    const { winnerInfo } = useWinnerInfo();

    return useMemo(() => {
        const cards = winnerInfo?.flatMap(w => w.cards ?? []) ?? [];
        return new Set(cards);
    }, [winnerInfo]);
};
