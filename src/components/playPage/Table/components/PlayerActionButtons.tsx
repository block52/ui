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
    pendingSitOut: string | null;
    totalSeatedPlayers: number;
    handNumber: number;
    hasActivePlayers: boolean;
}

export const PlayerActionButtons: React.FC<PlayerActionButtonsProps> = ({
    isMobile,
    isMobileLandscape,
    legalActions,
    tableId,
    currentNetwork,
    playerStatus,
    sitInMethod,
    pendingSitOut,
    totalSeatedPlayers,
    handNumber,
    hasActivePlayers
}) => {
    const isCompact = isMobile || isMobileLandscape;
    const positionClass = isMobileLandscape ? "bottom-2 left-2" : isMobile ? "bottom-[260px] right-4" : "bottom-20 left-4";

    // Checkbox is driven by pendingSitOut from game state (not local state)
    const isChecked = pendingSitOut === "next-hand";

    const handleToggleSitOutNextHand = () => {
        // Toggle: sends SIT_OUT to either queue or cancel
        handleSitOut(tableId, currentNetwork);
    };

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
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <label className="flex items-center mb-2 cursor-pointer">
                            <input
                                type="radio"
                                name="sit-in-method"
                                onChange={() => handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_NEXT_BB)}
                                className="form-radio h-4 w-4 text-green-500 border-gray-500 focus:ring-0"
                            />
                            <span className={`ml-2 text-white ${isCompact ? "text-xs" : "text-sm"}`}>
                                Sit In Next Big Blind
                            </span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="sit-in-method"
                                onChange={() => handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW)}
                                className="form-radio h-4 w-4 text-green-500 border-gray-500 focus:ring-0"
                            />
                            <span className={`ml-2 text-white ${isCompact ? "text-xs" : "text-sm"}`}>
                                Post Required Blinds Now
                            </span>
                        </label>
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
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={handleToggleSitOutNextHand}
                                className="form-checkbox h-4 w-4 text-amber-500 border-gray-500 rounded focus:ring-0"
                            />
                            <span className={`ml-2 ${isChecked ? "text-amber-300" : "text-white"} ${isCompact ? "text-xs" : "text-sm"}`}>
                                Sit Out Next Hand
                            </span>
                        </label>
                    </div>
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
