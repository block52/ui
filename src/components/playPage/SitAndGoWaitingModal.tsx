/**
 * SitAndGoWaitingModal Component
 *
 * Displays a modal for players who have joined a Sit & Go tournament
 * and are waiting for more players to fill the table before the game starts.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { hasValue, isNullish } from "../../utils/guards";
import { useGameOptions } from "../../hooks/game/useGameOptions";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { useGameStateContext } from "../../context/GameStateContext";
import { useNetwork } from "../../context/NetworkContext";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { startTournament } from "../../hooks/playerActions/startTournament";
import { getGameTypeMnemonic } from "../../utils/gameFormatUtils";
import { formatSitAndGoStackString } from "../../utils/numberUtils";
import { formatCountdown, formatStartsAt, isScheduledSng, scheduledSngPhase } from "../../utils/scheduledSng";
import styles from "./SitAndGoWaitingModal.module.css";

interface SitAndGoWaitingModalProps {
    tableId?: string;
    onLeaveConfirm?: () => Promise<void>;
    playerStack?: string;
}

const SitAndGoWaitingModal: React.FC<SitAndGoWaitingModalProps> = ({ tableId, onLeaveConfirm, playerStack }) => {
    const { gameOptions } = useGameOptions();
    const { emptySeatIndexes } = useVacantSeatData();
    const { gameState } = useGameStateContext();
    const { currentNetwork } = useNetwork();
    const { legalActions } = usePlayerLegalActions();

    // Scheduled start (poker-vm#2680): a clock for the countdown and the phase.
    // Once the start time has passed with the minimum registered ("ready"),
    // ANY registered player may press "Start now" (ui#830): the chain checks
    // the block time and the field when the action lands, and a refusal shows
    // under the button. The button is NOT gated on the engine offering START
    // in legalActions — the chain stores the legal actions as of the last
    // transaction, so while everyone waits they never include START. If a
    // refresh does carry the offer, the client sends START by itself. The
    // first START in a block wins; the rest are refused as already started,
    // which is harmless.
    const scheduled = isScheduledSng(gameOptions);
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        if (!scheduled) return;
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, [scheduled]);
    const registered = gameState?.players?.length ?? 0;
    const phase = scheduledSngPhase({
        scheduledStartTime: gameOptions?.scheduledStartTime,
        minPlayers: gameOptions?.minPlayers ?? 2,
        registered,
        nowMs
    });
    const startOffered = legalActions.some(a => a.action === NonPlayerActionType.START);
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const autoStartFired = useRef(false);
    const sendStart = useCallback(async () => {
        if (!tableId) return;
        setIsStarting(true);
        setStartError(null);
        try {
            await startTournament(tableId, currentNetwork);
        } catch (err) {
            console.error("Error starting the tournament:", err);
            setStartError(err instanceof Error ? err.message : "Failed to start. Please try again.");
            setIsStarting(false);
        }
    }, [tableId, currentNetwork]);
    useEffect(() => {
        if (startOffered && !autoStartFired.current) {
            autoStartFired.current = true;
            void sendStart();
        }
    }, [startOffered, sendStart]);

    const [isConfirming, setIsConfirming] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

    const handleLeaveClick = useCallback(() => {
        setLeaveError(null);
        setIsConfirming(true);
    }, []);

    const handleCancel = useCallback(() => {
        setIsConfirming(false);
        setLeaveError(null);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!onLeaveConfirm) return;
        setIsLeaving(true);
        setLeaveError(null);
        try {
            await onLeaveConfirm();
        } catch (err) {
            console.error("Error leaving SNG table:", err);
            setLeaveError(err instanceof Error ? err.message : "Failed to leave table. Please try again.");
            setIsLeaving(false);
        }
    }, [onLeaveConfirm]);

    const chipsLabel = hasValue(playerStack) ? formatSitAndGoStackString(playerStack) : null;
    const buyInLabel = gameOptions?.startingStack ? formatSitAndGoStackString(gameOptions.startingStack) : null;
    const canShowLeaveUi = hasValue(onLeaveConfirm) && hasValue(playerStack);

    // Calculate players joined
    const playersJoined = useMemo(() => {
        if (!gameOptions?.maxPlayers) return 0;
        return gameOptions.maxPlayers - emptySeatIndexes.length;
    }, [gameOptions?.maxPlayers, emptySeatIndexes.length]);

    const maxPlayers = gameOptions?.maxPlayers;

    const playerCountLabel = getGameTypeMnemonic(scheduled ? gameOptions?.maxPlayers : gameOptions?.minPlayers);

    // Don't render until game options are loaded
    if (isNullish(maxPlayers)) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-xl w-96 shadow-2xl border border-blue-400/20 relative overflow-hidden">
                {/* Web3 styled background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-xl"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse"></div>

                <div className="relative z-10">
                    <div className="flex items-center justify-center mb-4">
                        <img src="/block52.png" alt="Block52 Logo" className="h-16 w-auto object-contain" />
                    </div>

                    {/* Waiting Icon with Animation */}
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30 relative">
                            {/* Rotating ring animation */}
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin"></div>
                            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2 text-shadow">
                        {phase === "cancelled" ? "Tournament Cancelled" : phase === "ready" ? "Starting" : "Waiting for Players"}
                    </h2>
                    <p className="text-gray-300 text-center mb-6 text-sm">
                        {phase === "cancelled"
                            ? "Not enough players registered by the start time. Leave to get your buy-in back."
                            : `${playerCountLabel} tournament is filling up...`}
                    </p>

                    {/* Scheduled start (poker-vm#2680) */}
                    {scheduled && hasValue(gameOptions?.scheduledStartTime) && phase !== "cancelled" && (
                        <div className="mb-4 bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30 text-center" data-testid="scheduled-start-panel">
                            {phase === "registering" ? (
                                <>
                                    <div className="text-xs text-blue-300 font-semibold">STARTS IN</div>
                                    <div className="text-2xl text-white font-mono font-bold">{formatCountdown(gameOptions.scheduledStartTime, nowMs)}</div>
                                    <div className="text-xs text-gray-400">
                                        {formatStartsAt(gameOptions.scheduledStartTime, nowMs)} · needs {gameOptions.minPlayers} of {maxPlayers}, or starts early when full
                                    </div>
                                </>
                            ) : phase === "short" ? (
                                <>
                                    <div className="text-xs text-yellow-300 font-semibold">START TIME PASSED</div>
                                    <div className="text-sm text-gray-200">
                                        Waiting for {Math.max(0, (gameOptions.minPlayers ?? 2) - registered)} more to reach the minimum of {gameOptions.minPlayers}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        Cancelled with refunds at {formatStartsAt(gameOptions.scheduledStartTime + 15 * 60 * 1000, nowMs)} if still short
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-xs text-green-300 font-semibold">READY TO START</div>
                                    <button
                                        type="button"
                                        onClick={() => void sendStart()}
                                        disabled={isStarting}
                                        className="mt-2 w-full py-2 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                                        data-testid="start-tournament-button"
                                    >
                                        {isStarting ? "Starting…" : "Start now"}
                                    </button>
                                    {startError && <div className="text-xs text-red-300 mt-2">{startError}</div>}
                                </>
                            )}
                        </div>
                    )}

                    {/* Players Progress Display */}
                    <div className="mb-6">
                        <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-4 border border-blue-500/30">
                            <div className="text-center mb-3">
                                <div className="text-xs text-blue-300 font-semibold mb-2">PLAYERS JOINED</div>
                                <div className="text-3xl text-white font-bold">
                                    {playersJoined} / {maxPlayers}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-3">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${(playersJoined / maxPlayers) * 100}%` }}
                                ></div>
                            </div>

                            {/* Waiting indicator */}
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <div className="flex gap-1">
                                    <div className={`w-2 h-2 bg-blue-400 rounded-full animate-bounce ${styles.waitingDotDelay0}`}></div>
                                    <div className={`w-2 h-2 bg-blue-400 rounded-full animate-bounce ${styles.waitingDotDelay150}`}></div>
                                    <div className={`w-2 h-2 bg-blue-400 rounded-full animate-bounce ${styles.waitingDotDelay300}`}></div>
                                </div>
                                <span className="text-gray-400 text-sm">
                                    Waiting for {maxPlayers - playersJoined} more {maxPlayers - playersJoined === 1 ? "player" : "players"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Your Status */}
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-400 font-semibold text-sm">
                                Waiting for players, you are {playersJoined} of {maxPlayers}
                            </span>
                        </div>
                    </div>


                    {/* Leave Game — inline two-step confirmation (no separate modal) */}
                    {canShowLeaveUi && !isConfirming && (
                        <div className="mb-4">
                            <button
                                onClick={handleLeaveClick}
                                className="w-full py-2 px-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/60 transition-colors duration-200"
                            >
                                Leave Game
                            </button>
                        </div>
                    )}

                    {canShowLeaveUi && isConfirming && (
                        <div className="mb-4 bg-gray-700/80 backdrop-blur-sm rounded-lg p-4 border border-red-500/40">
                            <p className="text-white text-sm font-semibold mb-3 text-center">Leave this tournament?</p>

                            <div className="space-y-1.5 mb-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Your Chips:</span>
                                    <span className="text-white font-bold">{chipsLabel}</span>
                                </div>
                                {buyInLabel && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Buy-In:</span>
                                        <span className="text-gray-300">{buyInLabel}</span>
                                    </div>
                                )}
                            </div>

                            {leaveError && (
                                <p className="text-red-400 text-xs mb-3 text-center break-words">{leaveError}</p>
                            )}

                            <div className="flex flex-col space-y-2">
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLeaving}
                                    className="w-full py-2 px-4 rounded-lg border border-red-500/60 bg-red-500/20 text-red-300 text-sm font-medium hover:bg-red-500/30 hover:border-red-500/80 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLeaving ? "Leaving..." : "Confirm Leave"}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isLeaving}
                                    className="w-full py-2 px-4 rounded-lg border border-gray-500/40 bg-gray-600/30 text-gray-300 text-sm font-medium hover:bg-gray-600/50 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-xs text-gray-400">
                            {scheduled
                                ? "Starts when the table is full, or at the start time with at least the minimum"
                                : "Tournament starts automatically when all players are seated"}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                            <span className="text-xs text-gray-400">Powered by Block52</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SitAndGoWaitingModal;
