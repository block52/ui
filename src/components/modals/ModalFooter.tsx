import React from "react";

/**
 * Action row pinned to the bottom of a scrolling Modal so the primary button is
 * always in view, however long the form is.
 *
 * Layout notes (this is subtle, see Modal.module.css):
 * - No negative bottom margin: a sticky element is clamped inside its parent's content box,
 *   so a footer hanging below it got pushed up over the last field.
 * - The Modal drops its own bottom padding when it contains a [data-modal-footer]; the
 *   footer's own bottom padding (including the phone safe area) replaces it, so the
 *   spacing under the buttons is the same whether the content fits or scrolls.
 * - Negative side margins cancel the Modal's side padding so the divider runs edge to edge.
 */
export const ModalFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
        data-modal-footer=""
        className="sticky bottom-0 z-10 -mx-5 sm:-mx-6 mt-5 px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 bg-surface-card border-t border-line flex flex-col gap-2"
    >
        {children}
    </div>
);
