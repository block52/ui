import { useMemo } from "react";
import { ActionDTO, PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PlayerChipDataReturn } from "../../types/index";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { usePlayersBySeat } from "../game/usePlayersBySeat";
import { shouldShowChips, getRelevantChipAmounts, calculateCurrentRoundBetting, hasPlayerBetInRound } from "../../utils/chipUtils";
import { hasElements } from "../../utils/guards";

/**
 * Per-seat chip data for a single player.
 *
 * Returns:
 *  - chipAmount   → total chip pile string for the current round
 *  - chipActions  → per-action amounts in the current round display window
 *
 * Memos are keyed on the seat's primitive content + a monotonic action
 * fingerprint (previousActions length and last index). Recomputes only when
 * the affected seat or the action log actually changes — a WS message that
 * touches another seat short-circuits.
 */
export const usePlayerChipData = (seatIndex: number): PlayerChipDataReturn => {
    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();
    const playersBySeat = usePlayersBySeat();

    const player = useMemo<PlayerDTO | null>(() => {
        return playersBySeat.get(seatIndex) ?? null;
    }, [playersBySeat, seatIndex]);

    const round = gameState?.round;
    const previousActions: ActionDTO[] = gameState?.previousActions ?? [];
    // Monotonic fingerprint of the action log — changes only when a new
    // action lands, not on every gameState identity flip.
    const lastActionIndex = hasElements(previousActions) ? previousActions[previousActions.length - 1].index : -1;
    const actionsFingerprint = `${previousActions.length}:${lastActionIndex}`;

    const chipAmount = useMemo<string>(() => {
        if (!player?.address) return "0";
        if (!shouldShowChips(player.status)) return "0";

        if (round === TexasHoldemRound.ANTE || round === TexasHoldemRound.PREFLOP) {
            // Only show chips once the player has made a real betting action (not just buy-in)
            if (hasPlayerBetInRound(player.address, previousActions)) {
                return player.sumOfBets || "0";
            }
            return "0";
        }

        if (!round) return "0";
        return calculateCurrentRoundBetting(player.address, round, previousActions);
        // previousActions deliberately omitted — actionsFingerprint covers it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [player?.address, player?.status, player?.sumOfBets, round, actionsFingerprint]);

    const chipActions = useMemo<string[]>(() => {
        if (!player?.address) return [];
        if (!shouldShowChips(player.status)) return [];
        if (!round) return [];

        const amounts = getRelevantChipAmounts(player.address, round, previousActions);
        if (hasElements(amounts)) return amounts;

        // Fallback: render the running total as a single group when no per-action
        // amounts matched (covers edge cases like first-action sumOfBets display)
        return chipAmount && chipAmount !== "0" ? [chipAmount] : [];
        // previousActions deliberately omitted — actionsFingerprint covers it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [player?.address, player?.status, round, actionsFingerprint, chipAmount]);

    if (isLoading || error) {
        return { chipAmount: "0", chipActions: [], isLoading, error };
    }

    return { chipAmount, chipActions, isLoading: false, error: null };
};
