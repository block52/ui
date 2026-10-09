/**
 * Key handling for the layout debug overlay (ui#741).
 *
 * The overlay used to toggle on bare number keys (1–7) listened on `window`,
 * with no check for whether focus was in a text field. Typing a raise amount
 * like `100` or a `1` in any input flipped the overlays on mid-hand in
 * production. This module centralises — and makes testable — the gating logic:
 *
 * - All overlays toggle with **Ctrl+I** (⌘I on macOS). This also flips a
 *   "debug mode" gate.
 * - The single-overlay keys `2`–`7` are only honoured once debug mode is on.
 * - Key events originating from an editable element (input, textarea, select,
 *   contentEditable) are ignored entirely, so typing never toggles debug UI.
 */

import { isNullish } from "./guards";

/** Which overlay(s) a key press should toggle, or `null` for no-op. */
export type DebugOverlayAction =
    | "all" // Ctrl+I — toggle every overlay (and the debug-mode gate)
    | "geometry"
    | "seats"
    | "chips"
    | "dealers"
    | "crosshair"
    | "cards"
    | null;

/** Minimal shape of the key event we need — keeps the function unit-testable. */
export interface DebugKeyEvent {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    target?: EventTarget | null;
}

/** True when the event originated from a text-entry / editable element. */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
    if (isNullish(target) || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable === true;
}

/**
 * Resolve a key event to the debug action it should trigger.
 *
 * @param e            the key event (bare shape so tests need no DOM)
 * @param debugMode    whether Ctrl+I has already enabled debug mode — the
 *                     single-overlay keys `2`–`7` are gated behind this
 * @returns the action to perform, or `null` to ignore the event
 */
export function resolveDebugOverlayAction(e: DebugKeyEvent, debugMode: boolean): DebugOverlayAction {
    // Never react to typing in an input/textarea/select/contentEditable.
    if (isEditableTarget(e.target)) return null;

    // Ctrl+I (⌘I) toggles all overlays and flips the debug-mode gate.
    if ((e.ctrlKey || e.metaKey) && (e.key === "i" || e.key === "I")) {
        return "all";
    }

    // Single-overlay keys only work once debug mode has been turned on.
    if (!debugMode) return null;

    switch (e.key) {
        case "2":
            return "geometry";
        case "3":
            return "seats";
        case "4":
            return "chips";
        case "5":
            return "dealers";
        case "6":
            return "crosshair";
        case "7":
            return "cards";
        default:
            return null;
    }
}
