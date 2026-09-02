/**
 * Player Action Buttons Component
 *
 * Displays Sit Out button, Sit In method selection panel, and pending state
 * based on available player actions and player status.
 * Responsive design for mobile, tablet, and desktop viewports.
 */

import React, { useState, useEffect, useCallback } from "react";

import { GameFormat, LegalActionDTO } from "@block52/poker-vm-sdk";
// Raw sit-in/out hooks THROW on failure (unlike the swallowing handleSitIn/Out
// wrappers) so the ActionSubmitController can classify + surface the error.
import { SIT_IN_METHOD_POST_NOW, sitIn, sitOut, useAutoSitOutNextBB } from "../../../../hooks/playerActions";
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
    const { seatAtBottom, toggleSeatAtBottom, sitInOptions } = useGameSettings();
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

    // When the BB rotates onto our seat, fire the standard SIT_OUT(next-hand)
    // through the ActionSubmitController — same path as the manual toggle above,
    // so the two dedupe/serialize instead of racing into a sequence mismatch
    // (ui#567). Clear the box optimistically once fired; controller toasts any
    // failure and the user can re-check.
    const handleAutoSitOutNextBb = useCallback(() => {
        if (tableId) {
            submit({ actionName: "sit-out", run: () => sitOut(tableId, currentNetwork) });
        }
        setSitOutNextBbQueued(false);
    }, [tableId, currentNetwork, submit]);

    useAutoSitOutNextBB(
        findUserSeat(gameState, getCosmosAddressSync()),
        gameState?.bigBlindPosition,
        sitOutNextBbQueued,
        handleAutoSitOutNextBb
    );

    const display = getPlayerActionDisplay({
        playerStatus,
        sitInMethod,
        legalActions,
        totalSeatedPlayers,
        handNumber,
        hasActivePlayers,
        sitInOptions
    });

    // Auto-drive (ui#550, sitInOptions OFF by default): when the panel resolves to
    // "auto-sit-in", sit the player in automatically (post-now → dealt in next hand)
    // instead of showing the method UI. Rising-edge latch so it fires once; reset
    // when we leave the auto-sit-in state.
    const autoSitInFired = React.useRef(false);
    useEffect(() => {
        if (display.kind === "auto-sit-in" && !autoSitInFired.current && tableId) {
            autoSitInFired.current = true;
            submit({ actionName: "sit-in", run: () => sitIn(tableId, currentNetwork, SIT_IN_METHOD_POST_NOW) });
        }
        if (display.kind !== "auto-sit-in") {
            autoSitInFired.current = false;
        }
    }, [display.kind, tableId, currentNetwork, submit]);

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
    // the table so the local player sits at 6 o'clock. It is a persistent view
    // setting with no settings-sidebar equivalent, so it is rendered ALWAYS while
    // the local player is seated — above every panel (sit-in, waiting, sit-out) —
    // via `seatedFrame` below, rather than only in the sit-in states (#392/#2139).
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

    // Every seated-state panel shares the same anchored column: the 6-o'clock
    // toggle pinned at the top, the state-specific panel(s) stacked beneath it.
    // Each switch case now returns just its own panel content via this wrapper,
    // so the toggle is guaranteed to render regardless of sit-in/out/waiting.
    const seatedFrame = (panel: React.ReactNode) => (
        <>
            {buyChipsElement}
            <div className={`fixed z-30 ${positionClass} flex flex-col gap-2`}>
                {seatAtBottomToggle}
                {panel}
            </div>
        </>
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
            return seatedFrame(
                <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                    <div className="flex items-center gap-2">
                        <div className="animate-pulse w-2 h-2 rounded-full bg-yellow-400" />
                        <span className={`text-yellow-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>{display.waitingMessage}</span>
                    </div>
                </div>
            );

        case "sit-in-options":
            // Ignition model: a sat-out player returns with a single "I am back"
            // button — one intent, no method choice (the two-radio Next-Hand/Next-BB
            // picker is gone). Sits in post-now; the engine decides re-entry (posts
            // the BB on entry, dead-SB on the SB seat — no deadlock, #2553/#2556).
            return seatedFrame(
                <button
                    onClick={handleSitInClick}
                    disabled={sittingIn}
                    className={`flex items-center justify-center gap-2 rounded-lg shadow-lg border-2 font-bold tracking-wide uppercase transition-all duration-150 ${
                        sittingIn
                            ? "bg-green-700 border-green-600 text-green-200 cursor-wait"
                            : "bg-green-600 border-green-400 text-white hover:bg-green-500 hover:border-green-300 hover:scale-105 active:scale-95"
                    } ${isCompact ? "px-3 py-2 text-xs" : "px-5 py-3 text-sm"}`}
                >
                    {sittingIn ? (
                        <>
                            <div className="w-3 h-3 border-2 border-green-200 border-t-transparent rounded-full animate-spin" />
                            Sitting in...
                        </>
                    ) : (
                        "I am back"
                    )}
                </button>
            );

        case "sit-in-bootstrap":
            // Empty table (ui#50): a joiner lands SEATED and must explicitly sit in
            // before the first hand starts. Next-BB vs Post-Now is meaningless with
            // no orbit yet, so offer a single "Sit In" button (posts on the first
            // hand once both seats have sat in).
            return seatedFrame(
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
            );

        case "auto-sit-in":
            // Default flow (ui#550): sitting in happens automatically (see the
            // effect above) — show a brief indicator, no method UI.
            return seatedFrame(
                <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
                        <span className={`text-green-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>Sitting in...</span>
                    </div>
                </div>
            );

        case "sit-out-button":
            // Two INDEPENDENT checkboxes, not radios (#763, matches Ignition): the
            // boxes are separate queued conditions — "next hand" fires at the next
            // hand boundary, "next big blind" holds you in until the BB rotates back
            // to your seat (so you don't waste blinds already paid this orbit). Both
            // may be checked; per #763 "the first applicable condition triggers".
            return seatedFrame(
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
            );

        case "waiting-for-players":
            return seatedFrame(
                <div className={`backdrop-blur-sm rounded-lg shadow-lg border border-white/20 bg-black/60 ${isCompact ? "p-2" : "p-3"}`}>
                    <div className="flex items-center gap-2">
                        <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                        <span className={`text-blue-300 font-medium ${isCompact ? "text-xs" : "text-sm"}`}>Waiting for players to join...</span>
                    </div>
                </div>
            );

        case "none":
            // Seated but no panel to show (e.g. mid-hand): still surface the
            // 6-o'clock toggle so it is always reachable while seated.
            return seatedFrame(null);
    }
};
