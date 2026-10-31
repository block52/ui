import { useState, useEffect, useMemo, useRef } from "react";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { useReplay } from "../../context/gameState/ReplayContext";
import { NonPlayerActionType, PlayerStatus, PlayerDTO } from "@block52/poker-vm-sdk";
import { PlayerTimerReturn } from "../../types/index";
import { useGameOptions } from "../game/useGameOptions";
import { usePlayersBySeat } from "../game/usePlayersBySeat";
import { isNullish, safeLength } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { getTimeoutMs, timeoutToSeconds, getLatestActionTimestampMs, calcTimeRemaining, calcProgressPercent, makeTurnId, resolveTurnAnchor, TurnAnchor } from "../../utils/timerUtils";
import { timeBankGrantedMs } from "../../utils/turnClock";

/**
 * Player timer: how long the seat has left to act. It REPORTS time; it never acts.
 *
 * The countdown follows the chain's turn clock (`utils/turnClock.ts`): the
 * anchor ignores `time-bank` actions, and every time bank recorded this turn
 * adds `gameOptions.timeBankMs` (ui#19). Extra time exists only once the chain
 * has recorded it, so this screen never shows time the table won't honour.
 *
 * Automatic actions belong to the auto hooks (`useAutoFold`, `useAutoCheck`
 * and friends), which submit through the shared ActionSubmitController. This
 * hook used to carry a second, direct implementation of auto-fold/auto-check
 * that broadcast on its own — dead since the initial open-source commit, and
 * deleted in ui#644.
 *
 * @param _tableId The ID of the table (unused; kept for call-site compatibility)
 * @param playerSeat The seat number of the player to check (1-based)
 * @returns Object containing player status and timer information
 */
export const usePlayerTimer = (_tableId?: string, playerSeat?: number): PlayerTimerReturn => {
    const [currentTime, setCurrentTime] = useState(Date.now());

    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();
    const { isReplayMode } = useReplay();

    // Get game options for timeout value
    const { gameOptions } = useGameOptions();
    const playersBySeat = usePlayersBySeat();

    // Timer configuration via shared util
    const TIMEOUT_DURATION = useMemo(() => getTimeoutMs(gameOptions?.timeout), [gameOptions]);
    const timeoutInSeconds = useMemo(() => timeoutToSeconds(TIMEOUT_DURATION), [TIMEOUT_DURATION]);

    // Find the player by seat number
    const player = useMemo((): PlayerDTO | null => {
        if (!gameState?.players || isNullish(playerSeat)) {
            return null;
        }
        return playersBySeat.get(playerSeat) || null;
    }, [playersBySeat, gameState?.players, playerSeat]);

    // Actions that advanced the turn. A `time-bank` extends the turn without
    // advancing it, so it neither re-anchors the clock nor starts a new turn.
    const turnActions = useMemo(
        () => (gameState?.previousActions ?? []).filter(action => action.action !== NonPlayerActionType.TIME_BANK),
        [gameState?.previousActions]
    );

    // Get the last action timestamp (normalized to ms) via shared util
    const lastActionTimestamp = useMemo(() => getLatestActionTimestampMs(turnActions), [turnActions]);

    // Keep the countdown anchor monotonic WITHIN a turn. The raw lastActionTimestamp
    // is re-derived on every snapshot, so a re-broadcast that re-stamps the last
    // action (#561) or a snapshot momentarily missing previousActions — where the
    // util falls back to Date.now() (#560 reset-to-full) — would move the anchor
    // forward and make the timer jump back up. We re-anchor only when the turn
    // identity (seat-to-act + action count) actually changes.
    const actionCount = safeLength(turnActions);
    const turnId = useMemo(
        () => makeTurnId(gameState?.nextToAct, actionCount),
        [gameState?.nextToAct, actionCount]
    );
    const turnAnchorRef = useRef<TurnAnchor>({ turnId: "", anchorMs: lastActionTimestamp });
    turnAnchorRef.current = resolveTurnAnchor(turnAnchorRef.current, turnId, lastActionTimestamp);
    const anchoredActionTimestamp = turnAnchorRef.current.anchorMs;

    // Check if this player is next to act. A hand replay is a frozen snapshot with
    // no live turn, so no seat is ever "to act" — this keeps the countdown timer and
    // its per-second re-render off during replay (ui#721).
    const isNextToAct = useMemo((): boolean => {
        if (isReplayMode) return false;
        return gameState?.nextToAct === playerSeat;
    }, [isReplayMode, gameState?.nextToAct, playerSeat]);

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

    // Time the chain's time bank has granted this turn (ui#19).
    const timeBankMs = useMemo(() => timeBankGrantedMs(gameState), [gameState]);
    const totalTimeoutMs = TIMEOUT_DURATION + timeBankMs;
    const totalTimeoutSeconds = timeoutToSeconds(totalTimeoutMs);

    // Calculate time remaining via shared util
    const timeRemaining = useMemo((): number => {
        if (!isNextToAct) return 0;
        return calcTimeRemaining(currentTime, anchoredActionTimestamp, totalTimeoutMs, false);
    }, [currentTime, anchoredActionTimestamp, isNextToAct, totalTimeoutMs]);

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
        return calcProgressPercent(currentTime, anchoredActionTimestamp, totalTimeoutMs, false);
    }, [currentTime, anchoredActionTimestamp, isNextToAct, totalTimeoutMs]);

    return {
        playerStatus: player?.status || PlayerStatus.SEATED,
        timeoutValue: totalTimeoutSeconds, // Base timeout plus any time bank granted this turn
        progress: Math.ceil(totalTimeoutSeconds - timeRemaining), // Progress in seconds elapsed
        timeRemaining,
        isActive: isNextToAct && activePlayerCount >= 2, // Only show timer with 2+ players
        isLoading,
        error,
        hasUsedExtension: timeBankMs > 0,
        isCurrentUser,
        isCurrentUserTurn: isCurrentUser && isNextToAct
    };
};
