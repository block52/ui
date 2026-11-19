import React from "react";
import { Modal } from "../common/Modal";
import { LoadingSpinner } from "../common/LoadingSpinner";
import type { RebalanceNotice as RebalanceNoticeState } from "../../utils/rebalanceNotice";

export interface RebalanceNoticeProps {
    notice: RebalanceNoticeState | undefined;
}

/**
 * Compact, non-blocking table notice shown while a multi-table tournament
 * is waiting on a rebalance (block52/ui#1007). Uses the shared Modal shell
 * with no backdrop so Leave and the other table controls stay usable.
 */
export const RebalanceNotice: React.FC<RebalanceNoticeProps> = ({ notice }) => {
    if (!notice) return null;

    const message =
        notice.kind === "moving"
            ? `You are being moved to Table ${notice.tableNumber}`
            : "Tables are being rebalanced. Your game will resume shortly.";

    return (
        <Modal
            isOpen
            onClose={() => undefined}
            title="Rebalancing"
            showBackdrop={false}
            closeOnEscape={false}
            closeOnBackdropClick={false}
            scrollable={false}
            compact
            widthClass="w-80"
            patternId="hexagons-rebalance"
        >
            <div className="flex flex-col items-center text-center gap-3" data-testid="rebalance-notice" role="status" aria-live="polite">
                <LoadingSpinner size="md" className="text-white" />
                <p className="text-sm text-gray-300">{message}</p>
            </div>
        </Modal>
    );
};

export default RebalanceNotice;
