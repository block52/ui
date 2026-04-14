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
import GameStartCountdown from "../../common/GameStartCountdown";
import { SitAndGoAutoJoinModal } from "../../../modals";
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
    handleLeaveTableClick,
    recentTxHash,
    handleCloseTransactionPopup,
    isLeaveModalOpen,
    handleLeaveModalClose,
    handleLeaveTableConfirm,
    currentPlayerStack,
    isInActiveHand
}) => {
    return (
        <>
            {/* Game Start Countdown Modal */}
            {showCountdown && gameStartTime && (
                <GameStartCountdown gameStartTime={gameStartTime} onCountdownComplete={handleCountdownComplete} onSkip={handleSkipCountdown} />
            )}

            {/* Sit & Go Auto-Join Modal - Shows for Sit & Go games when user is not playing */}
            {gameState && gameFormat && isSitAndGoFormat(gameFormat) && !isUserAlreadyPlaying && tableId && (
                <SitAndGoAutoJoinModal tableId={tableId} onJoinSuccess={onAutoJoinSuccess} />
            )}

            {/* Sit & Go Waiting Modal - Shows for Sit & Go games when user is playing but waiting for more players */}
            {isSitAndGoWaitingForPlayers && <SitAndGoWaitingModal onLeaveClick={handleLeaveTableClick} />}

            {/* Transaction Popup - Bottom Right */}
            <TransactionPopup txHash={recentTxHash} onClose={handleCloseTransactionPopup} />

            {/* Leave Table Modal */}
            <LeaveTableModal
                isOpen={isLeaveModalOpen}
                onClose={handleLeaveModalClose}
                onConfirm={handleLeaveTableConfirm}
                playerStack={currentPlayerStack}
                isInActiveHand={isInActiveHand}
            />
        </>
    );
};
