import React, { useEffect, useCallback } from "react";
import { colors, getHexagonStroke } from "../../utils/colorConfig";
import styles from "./Modal.module.css";

/**
 * Shared hexagon pattern background for modals
 */
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

/**
 * Decorative card suits for modal corners
 */
const CardSuits = React.memo(() => (
    <>
        <div className="absolute -right-8 -top-8 text-6xl opacity-10 rotate-12">♠</div>
        <div className="absolute -left-8 -bottom-8 text-6xl opacity-10 -rotate-12">♥</div>
    </>
));

CardSuits.displayName = "CardSuits";

export interface BaseModalProps {
    /** Whether the modal is currently open/visible */
    isOpen: boolean;
    /** Callback when modal should be closed */
    onClose: () => void;
    /** Modal content */
    children: React.ReactNode;
    /** Optional title displayed at top of modal */
    title?: string;
    /** Optional icon/emoji to display before title */
    titleIcon?: React.ReactNode;
    /** Color for the title divider line (defaults to brand.primary) */
    titleDividerColor?: string;
    /** Error message to display */
    error?: string | null;
    /** Whether modal actions are currently processing (disables close on backdrop click) */
    isProcessing?: boolean;
    /** Width class for the modal (default: "w-96") */
    widthClass?: string;
    /** Additional className for the modal container */
    className?: string;
    /** Whether to show the hexagon pattern background (default: true) */
    showHexagonPattern?: boolean;
    /** Whether to show decorative card suits (default: true) */
    showCardSuits?: boolean;
    /** Unique pattern ID for hexagon SVG (to avoid conflicts with multiple modals) */
    patternId?: string;
    /** Whether to close on Escape key press (default: true) */
    closeOnEscape?: boolean;
    /** Whether to close on backdrop click (default: true when not processing) */
    closeOnBackdropClick?: boolean;
    /** Whether the modal content should scroll when it overflows (default: true) */
    scrollable?: boolean;
}

/**
 * BaseModal - A reusable modal component with consistent styling
 *
 * Features:
 * - Backdrop with blur effect
 * - Hexagon pattern background
 * - Decorative card suits
 * - Error display
 * - Keyboard shortcuts (Escape to close)
 * - Close on backdrop click
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Confirm Action"
 *   titleIcon="⚠"
 *   error={error}
 *   isProcessing={isLoading}
 * >
 *   <p>Modal content here</p>
 *   <button onClick={handleConfirm}>Confirm</button>
 * </Modal>
 * ```
 */
export const Modal: React.FC<BaseModalProps> = React.memo(
    ({
        isOpen,
        onClose,
        children,
        title,
        titleIcon,
        titleDividerColor = colors.brand.primary,
        error,
        isProcessing = false,
        widthClass = "w-96",
        className = "",
        showHexagonPattern = true,
        showCardSuits = true,
        patternId,
        closeOnEscape = true,
        closeOnBackdropClick = true,
        scrollable = true
    }) => {
        // Handle Escape key press
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

        // Handle backdrop click
        const handleBackdropClick = useCallback(() => {
            if (closeOnBackdropClick && !isProcessing) {
                onClose();
            }
        }, [closeOnBackdropClick, isProcessing, onClose]);

        // Don't render if not open
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                />

                {/* Modal Container */}
                <div
                    className={`relative p-6 rounded-xl shadow-2xl overflow-x-hidden ${scrollable ? "overflow-y-auto max-h-[90vh]" : "overflow-y-hidden"} ${widthClass} max-w-[95vw] ${className} ${styles.modalContainer}`}
                >
                    {/* Hexagon pattern background */}
                    {showHexagonPattern && <HexagonPattern patternId={patternId} />}

                    {/* Decorative card suits */}
                    {showCardSuits && <CardSuits />}

                    {/* Title */}
                    {title && (
                        <>
                            <h2 className="text-xl font-bold mb-3 text-white flex items-center">
                                {titleIcon && (
                                    <span style={{ color: titleDividerColor }} className="mr-2">
                                        {titleIcon}
                                    </span>
                                )}
                                {title}
                            </h2>
                            <div
                                className="w-full h-0.5 mb-4 opacity-50"
                                style={{
                                    background: `linear-gradient(to right, transparent, ${titleDividerColor}, transparent)`
                                }}
                            />
                        </>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className={`mb-4 p-3 rounded-lg ${styles.errorContainer}`}>
                            <p className={`text-sm ${styles.errorText}`}>
                                ⚠️ {error}
                            </p>
                        </div>
                    )}

                    {/* Modal Content */}
                    {children}
                </div>
            </div>
        );
    }
);

Modal.displayName = "Modal";

// Re-export the hexagon pattern for use in custom implementations
export { HexagonPattern };

export default Modal;
