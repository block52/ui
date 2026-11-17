import React, { useState, useCallback } from "react";
import { truncateMiddle } from "@block52/poker-ui-core/utils/stringUtils";
import { colors } from "../../utils/colorConfig";
import { Modal, LoadingSpinner } from "../common";
import styles from "./DeleteTableModal.module.css";

export interface ForceCloseTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    gameId: string;
    /** Current seated player count, surfaced in the warning copy. */
    seatedPlayerCount: number;
}

/**
 * Confirmation for force-closing a cash table with seated players.
 * Distinct from DeleteTableModal (empty-table path): the warning copy here
 * highlights that players will be kicked off AND refunded, which is a
 * stronger action than deleting an idle table.
 *
 * See block52/poker-vm#2173.
 */
const ForceCloseTableModal: React.FC<ForceCloseTableModalProps> = React.memo(
    ({ isOpen, onClose, onConfirm, gameId, seatedPlayerCount }) => {
        const [isClosing, setIsClosing] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const handleConfirm = useCallback(async () => {
            setIsClosing(true);
            setError(null);
            try {
                await onConfirm();
                onClose();
            } catch (err) {
                console.error("Error closing table:", err);
                setError(err instanceof Error ? err.message : "Failed to close table. Please try again.");
                setIsClosing(false);
            }
        }, [onConfirm, onClose]);

        const truncatedId = truncateMiddle(gameId, 6, 6);
        const playerWord = seatedPlayerCount === 1 ? "player" : "players";

        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Close Table"
                titleIcon="🛑"
                titleDividerColor={colors.accent.danger}
                error={error}
                isProcessing={isClosing}
                patternId="hexagons-close"
                scrollable={false}
            >
                <div className="mb-6">
                    <p className="text-gray-300 text-sm mb-4">
                        Are you sure you want to close this table?
                    </p>

                    <div className={`p-4 rounded-lg mb-4 ${styles.dangerAlert}`}>
                        <p className="text-white text-sm font-semibold mb-2">⚠️ This action cannot be undone</p>
                        <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
                            <li>
                                The current hand (if any) will be canceled — bets in the pot are returned to whoever
                                posted them.
                            </li>
                            <li>
                                All {seatedPlayerCount} {playerWord} will be kicked off the table and their stacks
                                refunded to their wallets.
                            </li>
                            <li>The table will be permanently removed from the blockchain.</li>
                        </ul>
                    </div>

                    <div className={`p-4 rounded-lg ${styles.panel}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Table ID:</span>
                            <span className="text-white font-mono text-sm">{truncatedId}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={handleConfirm}
                        disabled={isClosing}
                        className={`w-full px-5 py-3 rounded-lg font-medium text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed ${styles.buttonDanger}`}
                    >
                        {isClosing ? (
                            <>
                                <LoadingSpinner size="sm" />
                                <span>Closing...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                                <span>Close Table & Refund</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isClosing}
                        className={`w-full px-5 py-3 rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-50 hover:opacity-80 ${styles.buttonSecondary}`}
                    >
                        Cancel
                    </button>
                </div>
            </Modal>
        );
    }
);

ForceCloseTableModal.displayName = "ForceCloseTableModal";

export default ForceCloseTableModal;
