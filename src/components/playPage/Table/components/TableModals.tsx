/**
 * TableModals Component
 *
 * Encapsulates all modals and popups for the table:
 * - Game start countdown
 * - Sit & Go auto-join modal
 * - Sit & Go waiting modal
 * - Transaction popup
 * - Leave table modal
 * - Tournament-winner moment (ui#874), which holds the result modal back until
 *   the deciding hand and the winner have been shown
 */

import React from "react";
import { isSitAndGoFormat } from "../../../../utils/gameFormatUtils";
import GameStartCountdown from "../../common/GameStartCountdown";
import { SitAndGoAutoJoinModal, SitAndGoResultModal } from "../../../modals";
import SitAndGoWaitingModal from "../../SitAndGoWaitingModal";
import TransactionPopup from "../../common/TransactionPopup";
import { LeaveTableModal } from "../../../modals";
import TournamentWinnerMoment from "../../Animations/TournamentWinnerMoment";
import { useTournamentFinishMoment } from "../../../../hooks/game/useTournamentFinishMoment";
import { holdsResultModals } from "../../../../utils/tournamentFinish";

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
    // ui#874: a finish happening live holds the results / busted modal until the
    // deciding hand (and, at the end, the tournament-winner moment) has shown.
    const finishMoment = useTournamentFinishMoment();
    const holdResults = holdsResultModals(finishMoment.phase);

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
            {isSitAndGoWaitingForPlayers && (
                <SitAndGoWaitingModal
                    tableId={tableId}
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
                <SitAndGoResultModal tableId={tableId} onLeave={handleLeaveTableConfirm} onClaim={handleClaimWinnings} held={holdResults} />
            )}

            {/* Tournament-winner moment (ui#874): winner, prize, winning hand and
                runner-up, held before the results modal. */}
            {finishMoment.phase === "winner" && finishMoment.finish && <TournamentWinnerMoment finish={finishMoment.finish} />}

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
