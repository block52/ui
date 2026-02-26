/**
 * Player Action Buttons Component
 *
 * Displays Sit Out button, Sit In method selection panel, and pending state
 * based on available player actions and player status.
 * Responsive design for mobile, tablet, and desktop viewports.
 */

import React, { useEffect, useRef } from "react";
import { LegalActionDTO } from "@block52/poker-vm-sdk";
import { handleSitOut, handleSitIn } from "../../../common/actionHandlers";
import { SIT_IN_METHOD_NEXT_BB, SIT_IN_METHOD_POST_NOW } from "../../../../hooks/playerActions";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";
import { getPlayerActionDisplay } from "../../../../utils/playerActionDisplayUtils";

export interface PlayerActionButtonsProps {
    isMobile: boolean;
    isMobileLandscape: boolean;
    legalActions: LegalActionDTO[];
    tableId: string | undefined;
    currentNetwork: NetworkEndpoints;
    playerStatus: string | null;
    sitInMethod: string | null;
    totalSeatedPlayers: number;
    handNumber: number;
    hasActivePlayers: boolean;
}

const SitOutIcon: React.FC<{ size: string }> = ({ size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
    </svg>
);

export const PlayerActionButtons: React.FC<PlayerActionButtonsProps> = ({
    isMobile,
    isMobileLandscape,
    legalActions,
    tableId,
    currentNetwork,
    playerStatus,
    sitInMethod,
    totalSeatedPlayers,
    handNumber,
    hasActivePlayers
}) => {
    const isCompact = isMobile || isMobileLandscape;
    const positionClass = isMobileLandscape ? "bottom-2 left-2" : isMobile ? "bottom-[260px] right-4" : "bottom-20 left-4";

    const display = getPlayerActionDisplay({
        playerStatus, sitInMethod, legalActions, totalSeatedPlayers, handNumber, hasActivePlayers
    });

    // Auto-sit-in for bootstrap: fire SIT_IN automatically, method is irrelevant
    const hasTriggeredAutoSitIn = useRef(false);

    useEffect(() => {
        if (display.kind === "auto-sit-in" && !hasTriggeredAutoSitIn.current && tableId) {
            hasTriggeredAutoSitIn.current = true;
            console.log("🚀 Bootstrap: auto-sending SIT_IN for table:", tableId);
            handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_NEXT_BB);
        }
        // Reset when no longer in auto-sit-in state
        if (display.kind !== "auto-sit-in") {
            hasTriggeredAutoSitIn.current = false;
        }
    }, [display.kind, tableId, currentNetwork]);

    switch (display.kind) {
        case "pending":
            return (
                <div className={`fixed z-30 ${positionClass}`}>
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="animate-pulse w-2 h-2 rounded-full bg-yellow-400" />
                            <span className={`text-yellow-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>
                                {display.waitingMessage}
                            </span>
                        </div>
                        <button
                            onClick={() => handleSitOut(tableId, currentNetwork)}
                            className={`w-full btn-sit-out text-white font-medium rounded-lg shadow-md
                                backdrop-blur-sm transition-all duration-300 border
                                flex items-center justify-center gap-2 transform hover:scale-105
                                ${isCompact ? "py-1 px-2 text-xs" : "py-1.5 px-3 text-sm"}`}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            );

        case "sit-in-options":
            return (
                <div className={`fixed z-30 ${positionClass}`}>
                    <div className={`flex flex-col gap-2 ${isCompact ? "w-40" : "w-48"}`}>
                        <button
                            onClick={() => handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_NEXT_BB)}
                            className={`w-full text-white font-medium rounded-lg shadow-md
                                backdrop-blur-sm transition-all duration-300 border border-green-500/50
                                bg-green-600/30 hover:bg-green-600/50
                                flex items-center justify-center gap-2 transform hover:scale-105
                                ${isCompact ? "py-2 px-3 text-xs" : "py-2.5 px-4 text-sm"}`}
                        >
                            Sit In On Next Big Blind
                        </button>
                        <button
                            onClick={() => handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW)}
                            className={`w-full text-white font-medium rounded-lg shadow-md
                                backdrop-blur-sm transition-all duration-300 border border-white/20
                                bg-white/10 hover:bg-white/20
                                flex items-center justify-center gap-2 transform hover:scale-105
                                ${isCompact ? "py-2 px-3 text-xs" : "py-2.5 px-4 text-sm"}`}
                        >
                            Post Required Blinds Now
                        </button>
                    </div>
                </div>
            );

        case "auto-sit-in":
            // Brief spinner while auto-sit-in fires via useEffect
            return (
                <div className={`fixed z-30 ${positionClass}`}>
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <div className="flex items-center gap-2">
                            <div className="animate-spin w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full" />
                            <span className={`text-green-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>
                                Starting game...
                            </span>
                        </div>
                    </div>
                </div>
            );

        case "sit-out-button":
            return (
                <div className={`fixed z-30 ${positionClass}`}>
                    {isCompact ? (
                        <button
                            onClick={() => handleSitOut(tableId, currentNetwork)}
                            className="btn-sit-out text-white font-medium py-1.5 px-3 rounded-lg shadow-md text-xs
                                backdrop-blur-sm transition-all duration-300 border
                                flex items-center justify-center gap-2 transform hover:scale-105"
                        >
                            <SitOutIcon size="h-3 w-3" />
                            Sit Out
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSitOut(tableId, currentNetwork)}
                            className="btn-sit-out text-white font-medium py-2 px-4 rounded-lg shadow-md text-sm
                                backdrop-blur-sm transition-all duration-300 border
                                flex items-center justify-center gap-2 transform hover:scale-105"
                        >
                            <SitOutIcon size="h-4 w-4" />
                            Sit Out
                        </button>
                    )}
                </div>
            );

        case "waiting-for-players":
            return (
                <div className={`fixed z-30 ${positionClass}`}>
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <div className="flex items-center gap-2">
                            <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                            <span className={`text-blue-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>
                                Waiting for players to join...
                            </span>
                        </div>
                    </div>
                </div>
            );

        case "none":
            return null;
    }
};
