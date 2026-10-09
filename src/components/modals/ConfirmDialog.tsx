import React from "react";
import { Modal } from "../common";
import { PillButton } from "../ui";
import { noticeClass } from "./walletFormClasses";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    /** Optional amber box under the message for the one thing the user must not miss. */
    warning?: React.ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    /** "danger" makes the confirm button red (deleting, clearing). */
    tone?: "primary" | "danger";
    onConfirm: () => void;
    onCancel: () => void;
}

/** In-app window.confirm(): Cancel takes initial focus, Escape cancels, backdrop clicks do nothing. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    warning,
    confirmLabel,
    cancelLabel = "Cancel",
    tone = "primary",
    onConfirm,
    onCancel
}) => (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} widthClass="w-full max-w-[440px]" closeOnBackdropClick={false}>
        <div className="flex flex-col gap-4">
            <p className="m-0 text-[15px] leading-relaxed text-ink-soft">{message}</p>
            {warning && <div className={noticeClass.warning}>{warning}</div>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <PillButton variant="outline" size="lg" onClick={onCancel} className="sm:min-w-[120px]" data-autofocus="">
                    {cancelLabel}
                </PillButton>
                <PillButton
                    size="lg"
                    onClick={onConfirm}
                    className={`sm:min-w-[140px] ${tone === "danger" ? "!bg-red-600 hover:!bg-red-500" : ""}`}
                >
                    {confirmLabel}
                </PillButton>
            </div>
        </div>
    </Modal>
);

export default ConfirmDialog;
