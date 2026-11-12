import { useMemo } from "react";
import { ActionDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { PlayerChipDataReturn } from "../../types/index";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { usePlayersBySeat } from "../game/usePlayersBySeat";
import { shouldShowChips, getRelevantChipAmounts, seatBetChipAmount } from "../../utils/chipUtils";
import { hasContent, hasElements } from "../../utils/guards";
import { useClosingBetPresentation } from "./useClosingBetPresentation";

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

    const closing = useClosingBetPresentation();
    const closingAmount = player?.address && closing.phase !== "off"
        ? closing.chipsByAddress.get(player.address)
        : undefined;

    const chipAmount = useMemo<string>(() => {
        if (closingAmount) return closingAmount;
        return seatBetChipAmount(player, round, previousActions);
        // previousActions deliberately omitted — actionsFingerprint covers it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [player, round, actionsFingerprint, closingAmount]);

    const chipActions = useMemo<string[]>(() => {
        if (closingAmount) return [closingAmount];
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
    }, [player?.address, player?.status, round, actionsFingerprint, chipAmount, closingAmount]);

    if (isLoading || error) {
        return { chipAmount: "0", chipActions: [], collecting: false, isLoading, error };
    }

    return {
        chipAmount,
        chipActions,
        collecting: closing.phase === "collecting" && hasContent(closingAmount),
        isLoading: false,
        error: null
    };
};
