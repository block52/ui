import React, { useState, useCallback } from "react";
import { truncateMiddle } from "../../utils/stringUtils";
import { colors } from "../../utils/colorConfig";
import { Modal, LoadingSpinner } from "../common";
import { WarningIcon } from "./walletIcons";
import styles from "./DeleteTableModal.module.css";

export interface DeleteTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    gameId: string;
}

const DeleteTableModal: React.FC<DeleteTableModalProps> = React.memo(({ isOpen, onClose, onConfirm, gameId }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error("Error deleting table:", err);
            setError(err instanceof Error ? err.message : "Failed to delete table. Please try again.");
            setIsDeleting(false);
        }
    }, [onConfirm, onClose]);

    const truncatedId = truncateMiddle(gameId, 6, 6);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Table"
            titleIcon="🗑️"
            titleDividerColor={colors.accent.danger}
            error={error}
            isProcessing={isDeleting}
            patternId="hexagons-delete"
            scrollable={false}
        >
            <div className="mb-6">
                <p className="text-ink-soft text-sm mb-4">Are you sure you want to delete this table?</p>

                <div className={`p-4 rounded-lg mb-4 ${styles.dangerAlert}`}>
                    <p className="flex items-center gap-2 text-ink text-sm font-semibold mb-2">
                        <WarningIcon className="w-4 h-4 text-amber-400" />
                        This action cannot be undone
                    </p>
                    <p className="text-ink-soft text-xs">
                        The table will be permanently removed from the blockchain.
                    </p>
                </div>

                <div className={`p-4 rounded-lg ${styles.panel}`}>
                    <div className="flex justify-between items-center">
                        <span className="text-ink-muted text-sm">Table ID:</span>
                        <span className="text-ink font-mono text-sm">{truncatedId}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col space-y-3">
                <button
                    onClick={handleConfirm}
                    disabled={isDeleting}
                    className={`w-full px-5 py-3 rounded-btn font-medium text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed ${styles.buttonDanger}`}
                >
                    {isDeleting ? (
                        <>
                            <LoadingSpinner size="sm" />
                            <span>Deleting...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                            <span>Delete Table</span>
                        </>
                    )}
                </button>
                <button
                    onClick={onClose}
                    disabled={isDeleting}
                    className={`w-full px-5 py-3 rounded-btn text-ink font-medium transition-all duration-200 disabled:opacity-50 ${styles.buttonSecondary}`}
                >
                    Cancel
                </button>
            </div>
        </Modal>
    );
});

DeleteTableModal.displayName = "DeleteTableModal";

export default DeleteTableModal;
