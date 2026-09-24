import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { PlayerStatus, PlayerDTO } from "@block52/poker-vm-sdk";
import { PlayerTimerReturn } from "../../types/index";
import { useGameOptions } from "../game/useGameOptions";
import { usePlayersBySeat } from "../game/usePlayersBySeat";
import { isNullish, safeLength } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { getTimeoutMs, timeoutToSeconds, getLatestActionTimestampMs, calcTimeRemaining, calcProgressPercent, makeTurnId, resolveTurnAnchor, TurnAnchor } from "../../utils/timerUtils";

// Global state to track time extensions per seat
const timeExtensions = new Map<string, { extensionTime: number; hasUsedExtension: boolean }>();

/**
 * Player timer: how long the seat has left to act, and the one-per-turn time
 * extension. It REPORTS time; it never acts.
 *
 * Automatic actions belong to the auto hooks (`useAutoFold`, `useAutoCheck`
 * and friends), which submit through the shared ActionSubmitController. This
 * hook used to carry a second, direct implementation of auto-fold/auto-check
 * that broadcast on its own — dead since the initial open-source commit, and
 * deleted in ui#644.
 *
 * @param tableId The ID of the table (identifies the seat's extension slot)
 * @param playerSeat The seat number of the player to check (1-based)
 * @returns Object containing player status and timer information
 */
export const usePlayerTimer = (tableId?: string, playerSeat?: number): PlayerTimerReturn => {
    const [currentTime, setCurrentTime] = useState(Date.now());

    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();

    // Get game options for timeout value
    const { gameOptions } = useGameOptions();
    const playersBySeat = usePlayersBySeat();

    // Timer configuration via shared util
    const TIMEOUT_DURATION = useMemo(() => getTimeoutMs(gameOptions?.timeout), [gameOptions]);
    const timeoutInSeconds = useMemo(() => timeoutToSeconds(TIMEOUT_DURATION), [TIMEOUT_DURATION]);

    // Create unique key for this seat
    const seatKey = `${tableId}-${playerSeat}`;

    // Find the player by seat number
    const player = useMemo((): PlayerDTO | null => {
        if (!gameState?.players || isNullish(playerSeat)) {
            return null;
        }
        return playersBySeat.get(playerSeat) || null;
    }, [playersBySeat, gameState?.players, playerSeat]);

    // Get the last action timestamp (normalized to ms) via shared util
    const lastActionTimestamp = useMemo(
        () => getLatestActionTimestampMs(gameState?.previousActions),
        [gameState?.previousActions]
    );

    // Keep the countdown anchor monotonic WITHIN a turn. The raw lastActionTimestamp
    // is re-derived on every snapshot, so a re-broadcast that re-stamps the last
    // action (#561) or a snapshot momentarily missing previousActions — where the
    // util falls back to Date.now() (#560 reset-to-full) — would move the anchor
    // forward and make the timer jump back up. We re-anchor only when the turn
    // identity (seat-to-act + action count) actually changes.
    const actionCount = safeLength(gameState?.previousActions);
    const turnId = useMemo(
        () => makeTurnId(gameState?.nextToAct, actionCount),
        [gameState?.nextToAct, actionCount]
    );
    const turnAnchorRef = useRef<TurnAnchor>({ turnId: "", anchorMs: lastActionTimestamp });
    turnAnchorRef.current = resolveTurnAnchor(turnAnchorRef.current, turnId, lastActionTimestamp);
    const anchoredActionTimestamp = turnAnchorRef.current.anchorMs;

    // Check if this player is next to act
    const isNextToAct = useMemo((): boolean => {
        return gameState?.nextToAct === playerSeat;
    }, [gameState?.nextToAct, playerSeat]);

    // Count active players 
    const activePlayerCount = useMemo((): number => {
        if (!gameState?.players) return 0;
        return gameState.players.length;
    }, [gameState?.players]);

    // Check if this player is the current user
    const isCurrentUser = useMemo((): boolean => {
        const userAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase();
        return player?.address?.toLowerCase() === userAddress;
    }, [player]);

    // Get extension info for this seat
    const extensionInfo = timeExtensions.get(seatKey) || { extensionTime: 0, hasUsedExtension: false };

    // Reset extension when turn changes
    useEffect(() => {
        if (isNextToAct) {
            // Only reset if this is a new turn (different from last action timestamp)
            const currentExtension = timeExtensions.get(seatKey);
            if (!currentExtension || currentExtension.extensionTime !== lastActionTimestamp) {
                timeExtensions.set(seatKey, { extensionTime: 0, hasUsedExtension: false });
            }
        } else {
            // Clear extension when it's no longer this player's turn
            timeExtensions.delete(seatKey);
        }
    }, [isNextToAct, seatKey, lastActionTimestamp]);

    // Calculate time remaining via shared util
    const timeRemaining = useMemo((): number => {
        if (!isNextToAct) return 0;
        return calcTimeRemaining(currentTime, anchoredActionTimestamp, TIMEOUT_DURATION, extensionInfo.hasUsedExtension);
    }, [currentTime, anchoredActionTimestamp, isNextToAct, TIMEOUT_DURATION, extensionInfo.hasUsedExtension]);

    // Function to extend time
    const extendTime = useCallback(() => {
        if (!isNextToAct || !isCurrentUser || extensionInfo.hasUsedExtension) {
            return;
        }

        timeExtensions.set(seatKey, {
            extensionTime: lastActionTimestamp,
            hasUsedExtension: true
        });

    }, [isNextToAct, isCurrentUser, extensionInfo.hasUsedExtension, seatKey, lastActionTimestamp]);

    // Update current time every second - ONLY for active players
    useEffect(() => {
        if (!isNextToAct) {
            return; // Don't run timer for inactive players
        }

        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [isNextToAct]); // Re-run effect when player becomes active/inactive

    // Calculate progress (0-100) via shared util
    const _progress = useMemo(() => {
        if (!isNextToAct) return 0;
        return calcProgressPercent(currentTime, anchoredActionTimestamp, TIMEOUT_DURATION, extensionInfo.hasUsedExtension);
    }, [currentTime, anchoredActionTimestamp, isNextToAct, TIMEOUT_DURATION, extensionInfo.hasUsedExtension]);

    return {
        playerStatus: player?.status || PlayerStatus.SEATED,
        timeoutValue: timeoutInSeconds, // Dynamic timeout from game options
        progress: Math.ceil(timeoutInSeconds - timeRemaining), // Progress in seconds elapsed
        timeRemaining,
        isActive: isNextToAct && activePlayerCount >= 2, // Only show timer with 2+ players
        isLoading,
        error,
        extendTime,
        hasUsedExtension: extensionInfo.hasUsedExtension,
        canExtend: isNextToAct && isCurrentUser && !extensionInfo.hasUsedExtension && timeRemaining <= 10 && activePlayerCount >= 2,
        isCurrentUser,
        isCurrentUserTurn: isCurrentUser && isNextToAct
    };
};
