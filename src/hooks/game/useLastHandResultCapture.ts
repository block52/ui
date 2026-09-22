/**
 * Captures the showdown summary of the hand that just ended into the
 * lastHandResult store (stop-gap for fast showdowns — ui feedback 22 Sep 2026).
 *
 * Must be called from a component that is ALWAYS mounted on the table page
 * (Table itself): the History sidebar unmounts while closed, and the snapshot
 * forgets the winners as soon as the next hand deals, so the capture window is
 * the rendered END round — which the bus's showdownHold keeps on screen for a
 * couple of seconds even on instant all-in runouts.
 */

import { useEffect } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useWinnerInfo } from "./useWinnerInfo";
import { shouldShowWinnerSummary } from "../../components/ActionsLog.utils";
import { getShowdownSummaryLines } from "../../utils/showdownSummary";
import { setLastHandResult } from "../../utils/lastHandResult";
import { hasElements } from "../../utils/guards";

export const useLastHandResultCapture = (tableId: string | undefined): void => {
    // Rendered track on purpose: it is what the user saw, and END is held on it.
    const { gameState } = useGameStateContext();
    const { winnerInfo } = useWinnerInfo();

    useEffect(() => {
        if (!tableId || !gameState) return;
        if (!shouldShowWinnerSummary(gameState, winnerInfo)) return;

        const lines = getShowdownSummaryLines(gameState, winnerInfo);
        if (hasElements(lines)) {
            // The store drops identical re-captures, so per-frame effect runs
            // during the END hold cost nothing.
            setLastHandResult({ tableId, handNumber: gameState.handNumber, lines });
        }
    }, [tableId, gameState, winnerInfo]);
};
