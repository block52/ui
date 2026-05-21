/**
 * Player Action Buttons Component
 *
 * Displays Sit Out button, Sit In method selection panel, and pending state
 * based on available player actions and player status.
 * Responsive design for mobile, tablet, and desktop viewports.
 */

import React, { useState, useEffect, useRef } from "react";

import { LegalActionDTO, NonPlayerActionType } from "@block52/poker-vm-sdk";
import { handleSitOut, handleSitIn } from "../../../common/actionHandlers";
import { SIT_IN_METHOD_POST_NOW } from "../../../../hooks/playerActions";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";
import { getPlayerActionDisplay } from "../../../../utils/playerActionDisplayUtils";
import { toast } from "react-toastify";
import BuyChipsButton from "../../../BuyChipsButton";
import { useTableTopUp } from "../../../../hooks/game/useTableTopUp";
import { useGameStateContext } from "../../../../context/GameStateContext";
import { useGameSettings } from "../../../../context/GameSettingsContext";
import { isNullish } from "../../../../utils/guards";

// Wait for the chain to confirm sit-in via actionCount before re-enabling the
// button. Mirrors the dirty-state pattern landed in block52/ui#365 for the
// main action panel. See block52/ui#364 for the rationale.
const DIRTY_STATE_TIMEOUT_MS = 8000;

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
    isCurrentUserSeated: boolean;
    isTableFull: boolean;
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
    walletBalance,
    isCurrentUserSeated,
    isTableFull
}) => {
    const isCompact = isMobile || isMobileLandscape;
    const positionClass = isMobileLandscape ? "bottom-2 left-2" : isMobile ? "bottom-[260px] right-4" : "bottom-20 left-4";

    // Optimistic local state for immediate visual feedback
    const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null);

    // Dirty state for the Sit-In button. Was previously useOptimistic which
    // auto-reverts when the underlying transition completes — that's
    // exactly the gap we want to close: SDK SYNC return (~50ms) reverted
    // the button before the chain committed the sit-in (~5s later), so
    // the user could re-click. Now we hold the dirty state until either
    //   • chain advances actionCount past the value we captured at click
    //     (canonical "chain processed it" signal)
    //   • DIRTY_STATE_TIMEOUT_MS elapses (escape hatch)
    //   • handleSitIn throws (CheckTx rejected — clear immediately)
    const { gameState } = useGameStateContext();
    const { seatAtBottom, toggleSeatAtBottom } = useGameSettings();
    const [sittingIn, setSittingIn] = useState(false);
    const [pendingActionCount, setPendingActionCount] = useState<number | null>(null);

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

        const submittedAt = gameState?.actionCount ?? 0;
        setSittingIn(true);
        setPendingActionCount(submittedAt);
        try {
            await handleSitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW);
            // Success path: let the watcher useEffect clear when the chain
            // confirms via actionCount, or the timeout fires.
        } catch (err) {
            console.error("Sit-in failed:", err);
            setSittingIn(false);
            setPendingActionCount(null);
        }
    };

    // Canonical clear: chain has advanced past the actionCount at which we
    // submitted, i.e. the sit-in was committed.
    useEffect(() => {
        if (isNullish(pendingActionCount)) return;
        const current = gameState?.actionCount;
        if (!isNullish(current) && current > pendingActionCount) {
            setSittingIn(false);
            setPendingActionCount(null);
        }
    }, [gameState?.actionCount, pendingActionCount]);

    // Escape hatch: WS / chain stall, or CheckTx accepted but DeliverTx
    // rejected so actionCount never advanced. Re-enable the button so the
    // user can retry.
    useEffect(() => {
        if (isNullish(pendingActionCount)) return;
        const t = setTimeout(() => {
            console.warn(
                `[sit-in] no confirmation within ${DIRTY_STATE_TIMEOUT_MS}ms ` +
                    `for actionCount=${pendingActionCount}; clearing dirty state.`,
            );
            setSittingIn(false);
            setPendingActionCount(null);
        }, DIRTY_STATE_TIMEOUT_MS);
        return () => clearTimeout(t);
    }, [pendingActionCount]);
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

    if (!isCurrentUserSeated) {
        return (
            <>
                {buyChipsElement}
                <div className="fixed z-30 bottom-8 left-1/2 -translate-x-1/2">
                    <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                        <div className="flex items-center gap-2">
                            <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                            <span className={`text-blue-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>You are spectating this table</span>
                        </div>
                        {!isTableFull && (
                            <div className="flex items-center gap-2">
                                <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                                <span className={`text-blue-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>
                                    To join the table, click on an available seat.
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    }
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
                    <div className={`fixed z-30 ${positionClass} flex flex-col gap-2`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={seatAtBottom}
                                    onChange={toggleSeatAtBottom}
                                    className="form-checkbox h-4 w-4 text-amber-500 border-gray-500 rounded focus:ring-0"
                                />
                                <span className={`ml-2 ${seatAtBottom ? "text-amber-300" : "text-white"} ${isCompact ? "text-xs" : "text-sm"}`}>
                                    Seat me at 6 o'clock
                                </span>
                            </label>
                        </div>
                        <button
                            onClick={handleSitInClick}
                            disabled={sittingIn}
                            className={`flex items-center gap-2 rounded-lg shadow-lg border-2 font-bold tracking-wide uppercase transition-all duration-150 ${
                                sittingIn
                                    ? "bg-green-700 border-green-600 text-green-200 cursor-wait"
                                    : "bg-green-600 border-green-400 text-white hover:bg-green-500 hover:border-green-300 hover:scale-105 active:scale-95 animate-pulse"
                            } ${isCompact ? "px-3 py-2 text-xs" : "px-5 py-3 text-sm"}`}
                        >
                            {sittingIn ? (
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
