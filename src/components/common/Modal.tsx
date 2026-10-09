import React, { useCallback, useEffect, useRef } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { focusRing } from "../ui/focusRing";
import { colors, getHexagonStroke } from "../../utils/colorConfig";
import styles from "./Modal.module.css";

const HexagonPattern = React.memo<{ patternId?: string }>(({ patternId = "hexagons-modal" }) => (
    <div className="absolute inset-0 opacity-5 overflow-hidden pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id={patternId} width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(5)">
                    <path
                        d="M25,3.4 L45,17 L45,43.4 L25,56.7 L5,43.4 L5,17 L25,3.4 z"
                        stroke={getHexagonStroke()}
                        strokeWidth="0.6"
                        fill="none"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    </div>
));

HexagonPattern.displayName = "HexagonPattern";

const CardSuits = React.memo(() => (
    <>
        <div className="absolute -right-8 -top-8 text-6xl opacity-10 rotate-12">♠</div>
        <div className="absolute -left-8 -bottom-8 text-6xl opacity-10 -rotate-12">♥</div>
    </>
));

CardSuits.displayName = "CardSuits";

export interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    /** Optional one-line description shown under the title */
    subtitle?: string;
    /** Optional icon/emoji to display before title */
    titleIcon?: React.ReactNode;
    /** Color for the title icon (defaults to brand.primary) */
    titleDividerColor?: string;
    /** Error message to display */
    error?: string | null;
    /** Whether modal actions are currently processing (disables close on backdrop click) */
    isProcessing?: boolean;
    /** Width class for the modal (default: "w-96") */
    widthClass?: string;
    /** Additional className for the modal container */
    className?: string;
    /** Whether to show the hexagon pattern background (default: false) */
    showHexagonPattern?: boolean;
    /** Whether to show decorative card suits (default: false) */
    showCardSuits?: boolean;
    /** Unique pattern ID for hexagon SVG (to avoid conflicts with multiple modals) */
    patternId?: string;
    /** Whether to close on Escape key press (default: true) */
    closeOnEscape?: boolean;
    /** Whether to close on backdrop click (default: true when not processing) */
    closeOnBackdropClick?: boolean;
    /** Whether the modal content should scroll when it overflows (default: true) */
    scrollable?: boolean;
    /** Hide the title row's close X, for flows where closing would lose data (default: false) */
    hideCloseButton?: boolean;
    /** Accessible name when the modal has no visible `title` */
    ariaLabel?: string;
}

/**
 * Shared dialog shell: backdrop, title row with close X, error banner, bottom sheet on phones.
 * Focus moves into the dialog on open (an element marked `data-autofocus`, else the first
 * control that is not the close X), is trapped by Tab/Shift+Tab, and returns to the trigger on
 * close. While `isProcessing`, Escape, the backdrop and the X are all inert.
 */
export const Modal: React.FC<BaseModalProps> = React.memo(
    ({
        isOpen,
        onClose,
        children,
        title,
        titleIcon,
        subtitle,
        titleDividerColor = colors.brand.primary,
        error,
        isProcessing = false,
        widthClass = "w-96",
        className = "",
        showHexagonPattern = false,
        showCardSuits = false,
        patternId,
        closeOnEscape = true,
        closeOnBackdropClick = true,
        scrollable = true,
        hideCloseButton = false,
        ariaLabel
    }) => {
        const dialogRef = useRef<HTMLDivElement>(null);
        useFocusTrap(dialogRef, isOpen);

        useEffect(() => {
            if (!isOpen || !closeOnEscape) return;

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape" && !isProcessing) {
                    onClose();
                }
            };

            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [isOpen, onClose, isProcessing, closeOnEscape]);

        const handleBackdropClick = useCallback(() => {
            if (closeOnBackdropClick && !isProcessing) {
                onClose();
            }
        }, [closeOnBackdropClick, isProcessing, onClose]);

        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                <div className="absolute inset-0 bg-overlay/70 backdrop-blur-sm" onClick={handleBackdropClick} />

                <div
                    ref={dialogRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title ?? ariaLabel}
                    className={`relative bg-surface-card border border-line rounded-2xl shadow-2xl text-ink-body p-5 sm:p-6 overflow-x-hidden focus:outline-none ${scrollable ? "overflow-y-auto max-h-[92vh] sm:max-h-[90vh]" : "overflow-y-hidden"} ${widthClass} ${className} ${styles.modalContainer}`}
                >
                    {showHexagonPattern && <HexagonPattern patternId={patternId} />}

                    {showCardSuits && <CardSuits />}

                    {title && (
                        <div className="relative flex items-center justify-between gap-3 -mt-1.5 mb-4 pb-3 border-b border-line">
                            <div className="min-w-0">
                                <h2 className="m-0 min-w-0 text-[17px] font-semibold text-ink flex items-center gap-2">
                                    {titleIcon && (
                                        <span style={{ color: titleDividerColor }} aria-hidden="true">
                                            {titleIcon}
                                        </span>
                                    )}
                                    <span className="truncate">{title}</span>
                                </h2>
                                {subtitle && <p className="m-0 mt-0.5 text-sm font-normal text-ink-muted">{subtitle}</p>}
                            </div>
                            {!hideCloseButton && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    aria-label="Close"
                                    data-modal-close=""
                                    className={`-mr-2.5 shrink-0 w-11 h-11 grid place-items-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                        <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="relative mb-4 flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                            <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <p className="m-0">{error}</p>
                        </div>
                    )}

                    {children}
                </div>
            </div>
        );
    }
);

Modal.displayName = "Modal";

export { HexagonPattern };

export default Modal;
