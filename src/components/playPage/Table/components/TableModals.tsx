/**
 * TableModals Component
 *
 * Encapsulates all modals and popups for the table:
 * - Game start countdown
 * - Sit & Go auto-join modal
 * - Sit & Go waiting modal
 * - Transaction popup
 * - Leave table modal
 */

import React from "react";
import { isSitAndGoFormat } from "../../../../utils/gameFormatUtils";
import { hasElements } from "../../../../utils/guards";
import GameStartCountdown from "../../common/GameStartCountdown";
import { SitAndGoAutoJoinModal, SitAndGoResultModal } from "../../../modals";
import SitAndGoWaitingModal from "../../SitAndGoWaitingModal";
import TransactionPopup from "../../common/TransactionPopup";
import { LeaveTableModal } from "../../../modals";

export interface TableModalsProps {
    // Game Start Countdown
    showCountdown: boolean;
    gameStartTime: string | null;
    handleCountdownComplete: () => void;
    handleSkipCountdown: () => void;

    // Sit & Go Auto-Join Modal
    gameState: unknown | null;
    gameFormat: string | null | undefined;
    isUserAlreadyPlaying: boolean;
    tableId: string | undefined;
    onAutoJoinSuccess: () => void;

    // Sit & Go Waiting Modal
    isSitAndGoWaitingForPlayers: boolean;
    handleLeaveTableClick: () => void;

    // Transaction Popup
    recentTxHash: string | null;
    handleCloseTransactionPopup: () => void;

    // Leave Table Modal
    isLeaveModalOpen: boolean;
    handleLeaveModalClose: () => void;
    handleLeaveTableConfirm: () => Promise<void>;
    handleClaimWinnings: () => Promise<void>;
    currentPlayerStack: string;
    isInActiveHand: boolean;
}

export const TableModals: React.FC<TableModalsProps> = ({
    showCountdown,
    gameStartTime,
    handleCountdownComplete,
    handleSkipCountdown,
    gameState,
    gameFormat,
    isUserAlreadyPlaying,
    tableId,
    onAutoJoinSuccess,
    isSitAndGoWaitingForPlayers,
    recentTxHash,
    handleCloseTransactionPopup,
    isLeaveModalOpen,
    handleLeaveModalClose,
    handleLeaveTableConfirm,
    handleClaimWinnings,
    currentPlayerStack,
    isInActiveHand
}) => {
    // A Sit & Go freezes its roster once it starts (poker-vm#2343): no player may
    // join a tournament already in progress. "Started" = past the pre-deal
    // bootstrap window — hand > 1, or any finishing result already recorded.
    // Without this guard the auto-join modal pops for any non-seated viewer of a
    // running SNG (e.g. a spectator, or after a bustout evicts a seat —
    // poker-vm#2404), inviting a join the chain will reject. block52/ui#511.
    const state = gameState as { handNumber?: number; results?: unknown[] } | null;
    const isStartedSitAndGo =
        !!gameFormat &&
        isSitAndGoFormat(gameFormat) &&
        ((state?.handNumber ?? 0) > 1 || hasElements(state?.results ?? []));

    return (
        <>
            {/* Game Start Countdown Modal */}
            {showCountdown && gameStartTime && (
                <GameStartCountdown gameStartTime={gameStartTime} onCountdownComplete={handleCountdownComplete} onSkip={handleSkipCountdown} />
            )}

            {/* Sit & Go Auto-Join Modal - Shows for Sit & Go games when the user is
                not playing AND the tournament has not yet started (frozen roster —
                see isStartedSitAndGo). */}
            {gameState && gameFormat && isSitAndGoFormat(gameFormat) && !isUserAlreadyPlaying && !isStartedSitAndGo && tableId && (
                <SitAndGoAutoJoinModal tableId={tableId} onJoinSuccess={onAutoJoinSuccess} />
            )}

            {/* Sit & Go Waiting Modal - Shows for Sit & Go games when user is playing but waiting for more players */}
            {isSitAndGoWaitingForPlayers && (
                <SitAndGoWaitingModal
                    onLeaveConfirm={handleLeaveTableConfirm}
                    playerStack={currentPlayerStack}
                />
            )}

            {/* Sit & Go Result Modal - Self-gates on the user having a tournament
                result in gameState.results[]. Skips the LeaveTableModal confirm
                step and goes straight to the chain leave: the user has already
                acknowledged the result by clicking "Leave Table", and the
                table is finished — no balance-still-on-table concern.
                block52/ui#371. */}
            {gameFormat && isSitAndGoFormat(gameFormat) && (
                <SitAndGoResultModal tableId={tableId} onLeave={handleLeaveTableConfirm} onClaim={handleClaimWinnings} />
            )}

            {/* Transaction Popup - Bottom Right */}
            <TransactionPopup txHash={recentTxHash} onClose={handleCloseTransactionPopup} />

            {/* Leave Table Modal — cash games only.
                SNG/Tournament players cannot leave an in-play tournament
                (frozen roster; the chain drops LEAVE from legal actions once a
                blind is posted — poker-vm#2343/#2349). Showing this generic
                modal after a bust-out let players wrongly leave, rebuy, and
                re-trigger the waiting modal for everyone (block52/ui#465). SNG
                leave/terminal flows are handled by SitAndGoWaitingModal
                (pre-start un-join) and SitAndGoResultModal (post-finish claim). */}
            {!(gameFormat && isSitAndGoFormat(gameFormat)) && (
                <LeaveTableModal
                    isOpen={isLeaveModalOpen}
                    onClose={handleLeaveModalClose}
                    onConfirm={handleLeaveTableConfirm}
                    playerStack={currentPlayerStack}
                    isInActiveHand={isInActiveHand}
                />
            )}
        </>
    );
};
