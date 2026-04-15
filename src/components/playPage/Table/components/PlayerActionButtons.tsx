/**
 * Player Action Buttons Component
 *
 * Displays Sit Out button, Sit In method selection panel, and pending state
 * based on available player actions and player status.
 * Responsive design for mobile, tablet, and desktop viewports.
 */

import React, { useState, useEffect, useRef, useOptimistic, startTransition } from "react";

import { LegalActionDTO, NonPlayerActionType } from "@block52/poker-vm-sdk";
import { handleSitOut, handleSitIn } from "../../../common/actionHandlers";
import { SIT_IN_METHOD_POST_NOW } from "../../../../hooks/playerActions";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";
import { getPlayerActionDisplay } from "../../../../utils/playerActionDisplayUtils";
import { toast } from "react-toastify";
import BuyChipsButton from "../../../BuyChipsButton";
import { useTableTopUp } from "../../../../hooks/game/useTableTopUp";

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
    currentStack: string;
    minBuyIn: string;
    maxBuyIn: string;
    walletBalance: string;
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
    hasActivePlayers,
    currentStack,
    minBuyIn,
    maxBuyIn,
    walletBalance
}) => {
    const isCompact = isMobile || isMobileLandscape;
    const positionClass = isMobileLandscape ? "bottom-2 left-2" : isMobile ? "bottom-[260px] right-4" : "bottom-20 left-4";

    // Optimistic local state for immediate visual feedback
    const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null);
    const [optimisticSitIn, setOptimisticSitIn] = useOptimistic<boolean>(false);

    // Sync optimistic state with server state when it arrives
    const serverChecked = pendingSitOut === "next-hand";
    useEffect(() => {
        setOptimisticChecked(null);
    }, [pendingSitOut]);

    const isChecked = optimisticChecked ?? serverChecked;

    const handleToggleSitOutNextHand = () => {
        setOptimisticChecked(!isChecked);
        handleSitOut(tableId, currentNetwork);
    };

    const display = getPlayerActionDisplay({
        playerStatus,
        sitInMethod,
        legalActions,
        totalSeatedPlayers,
        handNumber,
        hasActivePlayers
    });

    // Top-up: check if TOP_UP is in legal actions
    const topUpAction = legalActions.find(a => a.action === NonPlayerActionType.TOP_UP);
    const canTopUp = !!topUpAction && !!tableId;
    const { topUp } = useTableTopUp(tableId || "", currentNetwork);

    const handleTopUp = async (amount: string) => {
        await topUp(amount);
    };

    // Bottom-right position for buy chips button (opposite side from action buttons)
    const buyChipsPositionClass = isMobileLandscape ? "bottom-2 right-2" : isMobile ? "bottom-[260px] left-4" : "bottom-20 right-4";

    // Auto-sit-in for bootstrap: fire SIT_IN automatically, method is irrelevant
    const hasTriggeredAutoSitIn = useRef(false);

    useEffect(() => {
        if (display.kind === "auto-sit-in" && !hasTriggeredAutoSitIn.current && tableId) {
            hasTriggeredAutoSitIn.current = true;
            console.log("🚀 Bootstrap: auto-sending SIT_IN for table:", tableId);
            // Bootstrap: method is irrelevant, use post-now (next-bb deferred, poker-vm#1895)
            handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW);
        }
        // Reset when no longer in auto-sit-in state
        if (display.kind !== "auto-sit-in") {
            hasTriggeredAutoSitIn.current = false;
        }
    }, [display.kind, tableId, currentNetwork]);

    const handleSitInClick = async () => {
        if (!tableId) return toast.error("Table ID is missing. Cannot sit in.");

        startTransition(async () => {
            console.log("🎯 Label clicked! TableId:", tableId, "Network:", currentNetwork);
            setOptimisticSitIn(true);
            await handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW);
        });
    };
    // Buy Chips button rendered independently (bottom-right, opposite to action buttons)
    const buyChipsElement =
        canTopUp && tableId ? (
            <div className={`fixed z-30 ${buyChipsPositionClass}`}>
                <BuyChipsButton
                    tableId={tableId}
                    currentStack={currentStack}
                    minBuyIn={minBuyIn}
                    maxBuyIn={maxBuyIn}
                    walletBalance={walletBalance}
                    canTopUp={canTopUp}
                    onTopUp={handleTopUp}
                />
            </div>
        ) : null;

    switch (display.kind) {
        case "pending":
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass}`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                            <div className="flex items-center gap-2">
                                <div className="animate-pulse w-2 h-2 rounded-full bg-yellow-400" />
                                <span className={`text-yellow-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>{display.waitingMessage}</span>
                            </div>
                        </div>
                    </div>
                </>
            );

        case "sit-in-options":
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass}`}>
                        <button
                            onClick={handleSitInClick}
                            disabled={optimisticSitIn}
                            className={`flex items-center gap-2 rounded-lg shadow-lg border-2 font-bold tracking-wide uppercase transition-all duration-150 ${
                                optimisticSitIn
                                    ? "bg-green-700 border-green-600 text-green-200 cursor-wait"
                                    : "bg-green-600 border-green-400 text-white hover:bg-green-500 hover:border-green-300 hover:scale-105 active:scale-95 animate-pulse"
                            } ${isCompact ? "px-3 py-2 text-xs" : "px-5 py-3 text-sm"}`}
                        >
                            {optimisticSitIn ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-green-200 border-t-transparent rounded-full animate-spin" />
                                    Sitting in...
                                </>
                            ) : (
                                "Sit In Next Hand"
                            )}
                        </button>
                    </div>
                </>
            );

        case "auto-sit-in":
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass}`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                            <div className="flex items-center gap-2">
                                <div className="animate-spin w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full" />
                                <span className={`text-green-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>Starting game...</span>
                            </div>
                        </div>
                    </div>
                </>
            );

        case "sit-out-button":
            return (
                <>
                    {buyChipsElement}
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
                </>
            );

        case "waiting-for-players":
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass}`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                            <div className="flex items-center gap-2">
                                <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                                <span className={`text-blue-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>Waiting for players to join...</span>
                            </div>
                        </div>
                    </div>
                </>
            );

        case "none":
            return buyChipsElement;
    }
};
