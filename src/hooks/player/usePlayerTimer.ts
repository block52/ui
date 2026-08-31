import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { useNetwork } from "../../context/NetworkContext";
import { PlayerStatus, PlayerDTO, PlayerActionType } from "@block52/poker-vm-sdk";
import { PlayerTimerReturn } from "../../types/index";
import { foldHand } from "../playerActions/foldHand";
import { checkHand } from "../playerActions/checkHand";
import { usePlayerLegalActions } from "../playerActions/usePlayerLegalActions";
import { useGameOptions } from "../game/useGameOptions";
import { isEmpty, isNullish } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { getTimeoutMs, timeoutToSeconds, getLatestActionTimestampMs, calcTimeRemaining, calcProgressPercent, makeTurnId, resolveTurnAnchor, TurnAnchor } from "../../utils/timerUtils";

// Global state to track time extensions per seat
const timeExtensions = new Map<string, { extensionTime: number; hasUsedExtension: boolean }>();

/**
 * Custom hook to manage player timer information with auto-fold functionality and time extensions
 * @param tableId The ID of the table for auto-fold actions
 * @param playerSeat The seat number of the player to check (1-based)
 * @returns Object containing player status and timer information
 */
export const usePlayerTimer = (tableId?: string, playerSeat?: number): PlayerTimerReturn => {
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [lastAutoFoldTime, setLastAutoFoldTime] = useState<number>(0);
    const { currentNetwork } = useNetwork();
    // Functions imported directly - no hook destructuring needed
    const { legalActions } = usePlayerLegalActions();

    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();

    // Get game options for timeout value
    const { gameOptions } = useGameOptions();

    // Timer configuration via shared util
    const TIMEOUT_DURATION = useMemo(() => getTimeoutMs(gameOptions?.timeout), [gameOptions]);
    const timeoutInSeconds = useMemo(() => timeoutToSeconds(TIMEOUT_DURATION), [TIMEOUT_DURATION]);

    // Create unique key for this seat
    const seatKey = `${tableId}-${playerSeat}`;

    // useRef to hold latest values for the callback
    const latestValues = useRef({
        legalActions,
        lastAutoFoldTime,
        timeoutInSeconds,
        isExecutingAutoAction: false
    });

    // Find the player by seat number
    const player = useMemo((): PlayerDTO | null => {
        if (!gameState?.players || isNullish(playerSeat)) {
            return null;
        }
        return gameState.players.find((p: PlayerDTO) => p.seat === playerSeat) || null;
    }, [gameState, playerSeat]);

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
    const turnId = useMemo(
        () => makeTurnId(gameState?.nextToAct, gameState?.previousActions?.length ?? 0),
        [gameState?.nextToAct, gameState?.previousActions?.length]
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

    // Update ref with latest values on each render
    latestValues.current = {
        legalActions,
        lastAutoFoldTime,
        timeoutInSeconds,
        isExecutingAutoAction: false
    };

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

    // Auto-action logic (check first, then fold if check not available)
    const _handleAutoAction = useCallback(async () => {
        // Use a flag to prevent concurrent executions
        if (latestValues.current.isExecutingAutoAction) {
            return;
        }
        latestValues.current.isExecutingAutoAction = true;

        // Get latest values from ref
        const { legalActions, lastAutoFoldTime, timeoutInSeconds } = latestValues.current;

        if (!isNextToAct || !isCurrentUser || !tableId) {
            latestValues.current.isExecutingAutoAction = false;
            return;
        }

        // Prevent multiple auto-actions in quick succession
        const timeSinceLastAutoFold = Date.now() - lastAutoFoldTime;
        if (timeSinceLastAutoFold < 5000) { // 5 second cooldown
            latestValues.current.isExecutingAutoAction = false;
            return;
        }

        // Check if player has legal actions (can actually act)
        if (isEmpty(legalActions)) {
            latestValues.current.isExecutingAutoAction = false;
            return;
        }

        // Check if check is a legal action (preferred over fold)
        const canCheck = legalActions.some(action => action.action === PlayerActionType.CHECK);
        const canFold = legalActions.some(action => action.action === PlayerActionType.FOLD);

        if (!canCheck && !canFold) {
            latestValues.current.isExecutingAutoAction = false;
            return;
        }

        try {
            setLastAutoFoldTime(Date.now());

            if (canCheck) {
                await checkHand(tableId!, currentNetwork);
            } else if (canFold) {
                await foldHand(tableId, currentNetwork);
            }
        } catch (error) {
            console.error("❌ Failed to auto-action:", error);
            // Don't throw here as it would break the component
        } finally {
            latestValues.current.isExecutingAutoAction = false;
        }
    }, [isNextToAct, isCurrentUser, tableId, playerSeat, currentNetwork]);

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

    // Auto-action when timer expires - COMMENTED OUT TO DISABLE AUTO-FOLD/AUTO-CHECK
    // useEffect(() => {
    //     if (timeRemaining === 0 && isNextToAct && isCurrentUser) {
    //         const timeoutId = setTimeout(() => {
    //             _handleAutoAction();
    //         }, 500); // Small delay to ensure state is stable

    //         return () => clearTimeout(timeoutId);
    //     }
    // }, [timeRemaining, isNextToAct, isCurrentUser, _handleAutoAction]);

    // Reset auto-action timer when next to act changes
    useEffect(() => {
        setLastAutoFoldTime(0);
    }, [gameState?.nextToAct]);

    // Calculate progress (0-100) via shared util
    const _progress = useMemo(() => {
        if (!isNextToAct) return 0;
        return calcProgressPercent(currentTime, anchoredActionTimestamp, TIMEOUT_DURATION, extensionInfo.hasUsedExtension);
    }, [currentTime, anchoredActionTimestamp, isNextToAct, TIMEOUT_DURATION, extensionInfo.hasUsedExtension]);

    // Debug logging (only in development)
    useEffect(() => {
        if (import.meta.env.DEV && isNextToAct && isCurrentUser) {
            const _extensionStatus = extensionInfo.hasUsedExtension ? " (EXTENDED)" : "";
        }
    }, [timeRemaining, isNextToAct, isCurrentUser, playerSeat, timeoutInSeconds, extensionInfo.hasUsedExtension]);

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