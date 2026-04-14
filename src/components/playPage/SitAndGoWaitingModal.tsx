/**
 * SitAndGoWaitingModal Component
 *
 * Displays a modal for players who have joined a Sit & Go tournament
 * and are waiting for more players to fill the table before the game starts.
 */
import React, { useMemo } from "react";
import { useGameOptions } from "../../hooks/game/useGameOptions";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { getGameTypeMnemonic } from "../../utils/gameFormatUtils";
import styles from "./SitAndGoWaitingModal.module.css";

interface SitAndGoWaitingModalProps {
    onLeaveClick?: () => void;
}

const SitAndGoWaitingModal: React.FC<SitAndGoWaitingModalProps> = ({ onLeaveClick }) => {
    const { gameOptions } = useGameOptions();
    const { emptySeatIndexes } = useVacantSeatData();

    // Calculate players joined
    const playersJoined = useMemo(() => {
        if (!gameOptions?.maxPlayers) return 0;
        return gameOptions.maxPlayers - emptySeatIndexes.length;
    }, [gameOptions?.maxPlayers, emptySeatIndexes.length]);

    const maxPlayers = gameOptions?.maxPlayers;

    const playerCountLabel = getGameTypeMnemonic(gameOptions?.minPlayers);

    // Don't render until game options are loaded
    if (maxPlayers === undefined) {
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

                    <h2 className="text-2xl font-bold text-white text-center mb-2 text-shadow">Waiting for Players</h2>
                    <p className="text-gray-300 text-center mb-6 text-sm">
                        {playerCountLabel} tournament is filling up...
                    </p>

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

                    
                    {/* Leave Game Button */}
                    {onLeaveClick && (
                        <div className="mb-4">
                            <button
                                onClick={onLeaveClick}
                                className="w-full py-2 px-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/60 transition-colors duration-200"
                            >
                                Leave Game
                            </button>
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-xs text-gray-400">Tournament starts automatically when all players are seated</p>
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
