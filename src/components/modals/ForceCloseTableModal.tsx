import React, { useState, useCallback } from "react";
import { truncateMiddle } from "../../utils/stringUtils";
import { Modal, LoadingSpinner } from "../common";
import { PillButton } from "../ui";
import { insetBoxClass, noticeClass } from "./walletFormClasses";
import { WarningIcon } from "./walletIcons";

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
                widthClass="w-[460px]"
                error={error}
                isProcessing={isClosing}
                patternId="hexagons-close"
                scrollable={false}
            >
                <div className="mb-6 space-y-4">
                    <p className="text-sm text-ink-soft">Are you sure you want to close this table?</p>

                    <div className={`${insetBoxClass} flex justify-between items-center gap-3`}>
                        <span className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Table ID:</span>
                        <span className="text-ink font-mono text-sm tabular-nums">{truncatedId}</span>
                    </div>

                    <div className={noticeClass.error}>
                        <p className="flex items-center gap-2 text-ink text-sm font-semibold mb-2">
                            <WarningIcon className="w-5 h-5 shrink-0 text-red-400" />
                            This action cannot be undone
                        </p>
                        <ul className="text-ink-soft text-xs space-y-1 list-disc list-inside">
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
                </div>

                <div className="flex flex-col gap-3 sm:flex-row-reverse">
                    <button
                        onClick={handleConfirm}
                        disabled={isClosing}
                        className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-red-600 hover:bg-red-500 text-white text-[15px] font-semibold whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                    >
                        {isClosing ? (
                            <>
                                <LoadingSpinner size="sm" />
                                <span>Closing...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                    <PillButton variant="outline" size="lg" className="w-full sm:flex-1" onClick={onClose} disabled={isClosing}>
                        Cancel
                    </PillButton>
                </div>
            </Modal>
        );
    }
);

ForceCloseTableModal.displayName = "ForceCloseTableModal";

export default ForceCloseTableModal;
