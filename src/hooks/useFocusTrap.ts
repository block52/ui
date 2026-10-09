import { RefObject, useEffect } from "react";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Mark the element that should receive focus first when a dialog opens (e.g. the safe button of a confirm). */
export const AUTOFOCUS_ATTR = "data-autofocus";
/** Mark close controls so they are not the default initial focus. */
export const CLOSE_ATTR = "data-modal-close";

const focusableIn = (container: HTMLElement): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

const initialFocusTarget = (container: HTMLElement): HTMLElement => {
    const explicit = container.querySelector<HTMLElement>(`[${AUTOFOCUS_ATTR}]:not([disabled])`);
    if (explicit) return explicit;
    const focusable = focusableIn(container);
    return focusable.find(el => !el.hasAttribute(CLOSE_ATTR)) ?? focusable[0] ?? container;
};

/**
 * While `active`, moves focus into `containerRef` (the `data-autofocus` element, else the first
 * control that is not a close button, else the container itself), keeps Tab and Shift+Tab inside
 * it, and returns focus to the previously focused element when it deactivates. The container
 * must be focusable (tabIndex -1).
 */
export const useFocusTrap = (containerRef: RefObject<HTMLElement | null>, active: boolean): void => {
    useEffect(() => {
        const container = containerRef.current;
        if (!active || !container) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        initialFocusTarget(container).focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return;
            const focusable = focusableIn(container);
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const current = document.activeElement;
            if (event.shiftKey && (current === first || current === container)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && current === last) {
                event.preventDefault();
                first.focus();
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => {
            container.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
        };
    }, [containerRef, active]);
};
