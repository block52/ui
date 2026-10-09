import React, { useState, useCallback } from "react";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { Modal, LoadingSpinner } from "../common";
import { PillButton } from "../ui";
import { WarningIcon } from "./walletIcons";
import { noticeClass } from "./walletFormClasses";
import type { LeaveTableModalProps } from "./types";

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
            title="Leave table?"
            subtitle="Your stack is returned to your wallet when you leave."
            widthClass="w-full max-w-[440px]"
            error={error}
            isProcessing={isLeaving}
            scrollable={false}
            showHexagonPattern={false}
        >
            <div className="flex flex-col gap-4">
                {isInActiveHand && (
                    <div className={noticeClass.warning} role="alert">
                        <p className="m-0 mb-1 flex items-center gap-2 text-sm font-semibold">
                            <WarningIcon className="w-4 h-4" />
                            Active hand
                        </p>
                        Leaving now will <strong>fold your hand</strong> and forfeit any chips you have bet this round.
                    </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-raised px-4 py-3.5">
                    <span className="text-sm text-ink-muted">Your stack</span>
                    <span className="text-lg font-bold tabular-nums text-ink">${stackFormatted}</span>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                    <PillButton variant="outline" size="lg" onClick={onClose} disabled={isLeaving} className="sm:min-w-[120px]" data-autofocus="">
                        Cancel
                    </PillButton>
                    <PillButton size="lg" onClick={handleConfirm} disabled={isLeaving} className="sm:min-w-[140px] !bg-red-600 hover:!bg-red-500">
                        {isLeaving ? (
                            <span className="inline-flex items-center gap-2">
                                <LoadingSpinner size="sm" />
                                Leaving…
                            </span>
                        ) : (
                            "Leave table"
                        )}
                    </PillButton>
                </div>
            </div>
        </Modal>
    );
});

LeaveTableModal.displayName = "LeaveTableModal";

export default LeaveTableModal;
