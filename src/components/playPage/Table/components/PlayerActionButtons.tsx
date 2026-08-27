/**
 * Player Action Buttons Component
 *
 * Displays Sit Out button, Sit In method selection panel, and pending state
 * based on available player actions and player status.
 * Responsive design for mobile, tablet, and desktop viewports.
 */

import React, { useState, useEffect } from "react";

import { GameFormat, LegalActionDTO, NonPlayerActionType } from "@block52/poker-vm-sdk";
// Raw sit-in/out hooks THROW on failure (unlike the swallowing handleSitIn/Out
// wrappers) so the ActionSubmitController can classify + surface the error.
import { SIT_IN_METHOD_POST_NOW, sitIn, sitInAndWait, sitOut, useAutoSitOutNextBB } from "../../../../hooks/playerActions";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";
import { getPlayerActionDisplay } from "../../../../utils/playerActionDisplayUtils";
import { toast } from "react-toastify";
import BuyChipsButton from "../../../BuyChipsButton";
import { useTableTopUp } from "../../../../hooks/game/useTableTopUp";
import { useGameStateContext } from "../../../../context/GameStateContext";
import { useGameSettings } from "../../../../context/GameSettingsContext";
import { useActionSubmit } from "../../../../context/ActionSubmitContext";
import { findUserSeat } from "../../../../utils/playerSeatUtils";
import { getCosmosAddressSync } from "../../../../utils/cosmosAccountUtils";

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

    // Browser-only intent for "Sit Out Next Big Blind" (#114). No chain state:
    // the hook below fires a standard SIT_OUT(next-hand) when bigBlindPosition
    // rotates onto our seat, then this flag is cleared so the box unchecks.
    const [sitOutNextBbQueued, setSitOutNextBbQueued] = useState<boolean>(false);

    // Sit-in/out submission runs through the shared ActionSubmitController: it
    // dedupes double-clicks, serializes, retries transport errors safely, holds
    // the spinner until the chain confirms a signal (ui#364), runs the 8s
    // escape-hatch, and toasts failures — replacing the hand-rolled dirty-state
    // this component used to carry.
    const { gameState, gameFormat } = useGameStateContext();
    const { seatAtBottom, toggleSeatAtBottom } = useGameSettings();
    const { submit, loadingAction } = useActionSubmit();
    const sittingIn = loadingAction === "sit-in";

    // Sync optimistic state with server state when it arrives
    const serverChecked = pendingSitOut === "next-hand";
    useEffect(() => {
        setOptimisticChecked(null);
    }, [pendingSitOut]);

    const isChecked = optimisticChecked ?? serverChecked;

    const handleToggleSitOutNextHand = () => {
        setOptimisticChecked(!isChecked);
        if (tableId) {
            submit({ actionName: "sit-out", run: () => sitOut(tableId, currentNetwork) });
        }
    };

    useAutoSitOutNextBB(
        tableId,
        currentNetwork,
        findUserSeat(gameState, getCosmosAddressSync()),
        gameState?.bigBlindPosition,
        sitOutNextBbQueued,
        () => setSitOutNextBbQueued(false), // clear box after fire
        () => setSitOutNextBbQueued(false)  // also clear on error so user can retry
    );

    const display = getPlayerActionDisplay({
        playerStatus,
        sitInMethod,
        legalActions,
        totalSeatedPlayers,
        handNumber,
        hasActivePlayers
    });

    // Top-up: never available in SNG games
    const isSNG = gameFormat === GameFormat.SIT_AND_GO;
    const { topUp } = useTableTopUp(tableId || "", currentNetwork);

    const handleTopUp = async (amount: string) => {
        await topUp(amount);
    };

    // Bottom-right position for buy chips button (opposite side from action buttons)
    const buyChipsPositionClass = isMobileLandscape ? "bottom-2 right-2" : isMobile ? "bottom-[260px] left-4" : "bottom-20 right-4";

    // Bootstrap (empty table) no longer auto-sends SIT_IN (ui#50): a joiner lands
    // SEATED and must explicitly click Sit In — see the "sit-in-bootstrap" case,
    // which renders a single "Sit In" button wired to handleSitInClick below.

    // Post Required Blinds Now (post-now): enter on the next legal hand posting the
    // blind. Fired on selecting the radio (or the single bootstrap button).
    const handleSitInClick = () => {
        if (!tableId) return toast.error("Table ID is missing. Cannot sit in.");
        submit({ actionName: "sit-in", run: () => sitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW) });
    };

    // Sit In Next Big Blind (wait-for-BB): the engine's distinct SIT_IN_AND_WAIT
    // action (the live Go engine treats plain SIT_IN as post-now-only). Only offered
    // when the chain surfaces it as a legal action.
    const canSitInAndWait = legalActions.some(a => a.action === NonPlayerActionType.SIT_IN_AND_WAIT);
    const handleSitInWait = () => {
        if (!tableId) return toast.error("Table ID is missing. Cannot sit in.");
        submit({ actionName: "sit-in", run: () => sitInAndWait(tableId, currentNetwork) });
    };

    // Top-Up Chips button: always visible and clickable while the user is seated (#401),
    // but completely hidden in SNG games where top-ups are not allowed (#2172).
    // Mid-hand top-ups are accepted by the chain and applied at the start of the next hand.
    const buyChipsElement =
        isCurrentUserSeated && tableId && !isSNG ? (
            <div className={`fixed z-30 ${buyChipsPositionClass}`}>
                <BuyChipsButton
                    tableId={tableId}
                    currentStack={currentStack}
                    minBuyIn={minBuyIn}
                    maxBuyIn={maxBuyIn}
                    walletBalance={walletBalance}
                    onTopUp={handleTopUp}
                />
            </div>
        ) : null;

    // Seat-orientation toggle (#392): a pure local view preference that rotates
    // the table so the local player sits at 6 o'clock. Surfaced both while
    // choosing to sit in AND while waiting for the big blind (#2139) — these are
    // the only places a just-seated player can reach it (no settings-sidebar
    // equivalent exists), so the waiting state must keep offering it.
    const seatAtBottomToggle = (
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
    );

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
                    <div className={`fixed z-30 ${positionClass} flex flex-col gap-2`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                            <div className="flex items-center gap-2">
                                <div className="animate-pulse w-2 h-2 rounded-full bg-yellow-400" />
                                <span className={`text-yellow-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>{display.waitingMessage}</span>
                            </div>
                        </div>
                        {display.showSeatOption && seatAtBottomToggle}
                    </div>
                </>
            );

        case "sit-in-options":
            // Original design (ui#112): a radio group inside the opaque panel that
            // commits on selection — no confirm button. "Sit In Next Big Blind"
            // (wait-for-BB) shows only when the chain offers SIT_IN_AND_WAIT.
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass} flex flex-col gap-2`}>
                        {seatAtBottomToggle}
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 flex flex-col gap-2 ${isCompact ? "p-2" : "p-3"}`}>
                            {canSitInAndWait && (
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="sit-in-method"
                                        disabled={sittingIn}
                                        onChange={handleSitInWait}
                                        className="form-radio h-4 w-4 text-green-500 border-gray-500 focus:ring-0"
                                    />
                                    <span className={`ml-2 text-white ${isCompact ? "text-xs" : "text-sm"}`}>Sit In Next Big Blind</span>
                                </label>
                            )}
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="sit-in-method"
                                    disabled={sittingIn}
                                    onChange={handleSitInClick}
                                    className="form-radio h-4 w-4 text-green-500 border-gray-500 focus:ring-0"
                                />
                                <span className={`ml-2 text-white ${isCompact ? "text-xs" : "text-sm"}`}>Sit In Next Hand</span>
                            </label>
                            {sittingIn && (
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-green-200 border-t-transparent rounded-full animate-spin" />
                                    <span className={`text-green-300 ${isCompact ? "text-xs" : "text-sm"}`}>Sitting in...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            );

        case "sit-in-bootstrap":
            // Empty table (ui#50): a joiner lands SEATED and must explicitly sit in
            // before the first hand starts. Next-BB vs Post-Now is meaningless with
            // no orbit yet, so offer a single "Sit In" button (posts on the first
            // hand once both seats have sat in).
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass} flex flex-col gap-2`}>
                        {seatAtBottomToggle}
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
                                "Sit In"
                            )}
                        </button>
                    </div>
                </>
            );

        case "sit-out-button":
            return (
                <>
                    {buyChipsElement}
                    <div className={`fixed z-30 ${positionClass}`}>
                        <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"} flex flex-col gap-1`}>
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
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={sitOutNextBbQueued}
                                    onChange={() => setSitOutNextBbQueued(prev => !prev)}
                                    className="form-checkbox h-4 w-4 text-amber-500 border-gray-500 rounded focus:ring-0"
                                />
                                <span className={`ml-2 ${sitOutNextBbQueued ? "text-amber-300" : "text-white"} ${isCompact ? "text-xs" : "text-sm"}`}>
                                    Sit Out Next Big Blind
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
