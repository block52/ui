/**
 * Where a small explanation bubble sits, and when it opens.
 *
 * The bubble hangs just above its icon, so it does not cover the figure.
 * Near the top of the screen it drops below. Near a side it shifts in so the
 * whole bubble stays inside the viewport. A fine pointer (mouse) opens it on
 * hover and focus.
 * A coarse pointer (a finger) toggles it on tap; hover is ignored there so
 * the first tap does not open and immediately close.
 */

export const TIP_GAP = 6;
export const TIP_MARGIN = 8;
export const TIP_MAX_WIDTH = 260;

export interface TipRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface TipViewport {
    width: number;
    height: number;
}

export interface TipPlacement {
    top: number;
    left: number;
    width: number;
}

export type TipSignal = "hover-in" | "hover-out" | "focus" | "blur" | "click" | "outside" | "escape";

/** True when the primary pointer can hover. Missing or unmatched media is a finger. */
export function pointerCanHover(matches: boolean | undefined): boolean {
    return matches === true;
}

/**
 * Next open state. Escape and a tap outside always close. On a fine pointer,
 * hover and focus show the bubble and a click leaves it as it is. On a coarse
 * pointer, only a tap toggles; hover and focus do not, so a tap is one event.
 */
export function tipOpenAfter(open: boolean, signal: TipSignal, finePointer: boolean): boolean {
    if (signal === "escape" || signal === "outside") return false;
    if (finePointer) {
        if (signal === "hover-in" || signal === "focus") return true;
        if (signal === "hover-out" || signal === "blur") return false;
        return open;
    }
    if (signal === "click") return !open;
    return open;
}

/**
 * Place the bubble above the icon so it does not cover the figure under the title.
 * When the top edge is too close it drops below. Side edges shift it back on screen.
 */
export function placeTip(anchor: TipRect, tipHeight: number, viewport: TipViewport): TipPlacement {
    const room = viewport.width - TIP_MARGIN * 2;
    const width = room > 0 ? Math.min(TIP_MAX_WIDTH, room) : 0;
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const maxLeft = viewport.width - TIP_MARGIN - width;
    const left = Math.min(Math.max(centered, TIP_MARGIN), Math.max(TIP_MARGIN, maxLeft));

    const below = anchor.top + anchor.height + TIP_GAP;
    const above = anchor.top - TIP_GAP - tipHeight;
    const fitsBelow = below + tipHeight <= viewport.height - TIP_MARGIN;
    const fitsAbove = above >= TIP_MARGIN;
    let top = below;
    if (fitsAbove) top = above;
    else if (!fitsBelow) {
        const clamped = Math.min(below, viewport.height - TIP_MARGIN - tipHeight);
        top = Math.max(TIP_MARGIN, clamped);
    }
    return { top, left, width };
}
