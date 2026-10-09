import React, { useState, useCallback } from "react";
import { colors } from "../../utils/colorConfig";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { Modal, LoadingSpinner } from "../common";
import { WarningIcon } from "./walletIcons";
import type { LeaveTableModalProps } from "./types";
import styles from "./LeaveTableModal.module.css";

const LeaveTableModal: React.FC<LeaveTableModalProps> = React.memo(({ isOpen, onClose, onConfirm, playerStack, isInActiveHand }) => {
    const [isLeaving, setIsLeaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        setIsLeaving(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error("Error leaving table:", err);
            setError(err instanceof Error ? err.message : "Failed to leave table. Please try again.");
            setIsLeaving(false);
        }
    }, [onConfirm, onClose]);

    const stackFormatted = formatUSDCToSimpleDollars(playerStack);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Leave Table"
            titleIcon="⚠"
            titleDividerColor={colors.accent.danger}
            error={error}
            isProcessing={isLeaving}
            patternId="hexagons-leave"
            scrollable={false}
        >
            <div className="mb-6">
                <p className="text-ink-soft text-sm mb-4">Are you sure you want to leave this table?</p>

                {isInActiveHand && (
                    <div className={`p-4 rounded-lg mb-4 ${styles.dangerAlertStrong}`}>
                        <p className="flex items-center gap-2 text-ink text-sm font-semibold mb-2">
                            <WarningIcon className="w-4 h-4 text-amber-400" />
                            Active Hand Warning
                        </p>
                        <p className="text-ink-soft text-xs">
                            You are currently in an active hand. Leaving now will automatically <strong>fold your hand</strong> and forfeit any
                            chips you have bet this round.
                        </p>
                    </div>
                )}

                <div className={`p-4 rounded-lg ${styles.panel}`}>
                    <div className="flex justify-between items-center">
                        <span className="text-ink-muted text-sm">Your Stack:</span>
                        <span className="text-ink font-bold text-lg">${stackFormatted}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col space-y-3">
                <button
                    onClick={handleConfirm}
                    disabled={isLeaving}
                    className={`w-full px-5 py-3 rounded-btn font-medium text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed ${styles.buttonDanger}`}
                >
                    {isLeaving ? (
                        <>
                            <LoadingSpinner size="sm" />
                            <span>Leaving...</span>
                        </>
                    ) : (
                        <span>Leave Table</span>
                    )}
                </button>
                <button
                    onClick={onClose}
                    disabled={isLeaving}
                    className={`w-full px-5 py-3 rounded-btn text-ink font-medium transition-all duration-200 disabled:opacity-50 ${styles.buttonSecondary}`}
                >
                    Cancel
                </button>
            </div>
        </Modal>
    );
});

LeaveTableModal.displayName = "LeaveTableModal";

export default LeaveTableModal;
