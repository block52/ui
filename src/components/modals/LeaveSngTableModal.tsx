import React, { useState, useCallback } from "react";
import { colors } from "../../utils/colorConfig";
import { Modal, LoadingSpinner } from "../common";
import styles from "./LeaveSngTableModal.module.css";

export interface LeaveSngTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    /** Player's current chip stack (integer, no decimals) */
    playerStack: string | undefined;
}

const LeaveSngTableModal: React.FC<LeaveSngTableModalProps> = React.memo(({ isOpen, onClose, onConfirm, playerStack }) => {
    const [isLeaving, setIsLeaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        setIsLeaving(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error("Error leaving SNG table:", err);
            setError(err instanceof Error ? err.message : "Failed to leave table. Please try again.");
            setIsLeaving(false);
        }
    }, [onConfirm, onClose]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Leave Sit & Go"
            titleIcon="🚪"
            titleDividerColor={colors.accent.danger}
            error={error}
            isProcessing={isLeaving}
            patternId="hexagons-leave-sng"
        >
            <div className="mb-6">
                <p className="text-gray-300 text-sm mb-4">Are you sure you want to leave this Sit & Go table?</p>

                {/* Chip stack info */}
                <div className={`p-4 rounded-lg ${styles.panel}`}>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Chips Stack:</span>
                        <span className="text-white font-bold text-lg">{playerStack ? Number(playerStack).toLocaleString() : "0"}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
                <button
                    onClick={handleConfirm}
                    disabled={isLeaving}
                    className={`w-full px-5 py-3 rounded-lg font-medium text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed ${styles.buttonDanger}`}
                >
                    {isLeaving ? (
                        <>
                            <LoadingSpinner size="sm" />
                            <span>Leaving...</span>
                        </>
                    ) : (
                        <span>Leave & Forfeit Chips</span>
                    )}
                </button>
                <button
                    onClick={onClose}
                    disabled={isLeaving}
                    className={`w-full px-5 py-3 rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-50 hover:opacity-80 ${styles.buttonSecondary}`}
                >
                    Cancel
                </button>
            </div>
        </Modal>
    );
});

LeaveSngTableModal.displayName = "LeaveSngTableModal";

export default LeaveSngTableModal;
