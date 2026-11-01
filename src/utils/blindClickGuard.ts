/**
 * Blind-click guard (ui#838).
 *
 * On macOS the browser's GPU process can drop or reset (memory pressure,
 * integrated/discrete GPU switch, display change). While it recovers the
 * window paints black, but the page itself keeps running: clicks still reach
 * the fold/call/raise buttons and the actions commit. The player is acting
 * blind with real money.
 *
 * While nothing is being painted the browser also stops delivering animation
 * frames, but timers keep firing. Measured in Chrome by crashing the GPU
 * process (CDP Browser.crashGpuProcess): frames stopped for ~570ms while every
 * click in that window was still delivered to the page.
 *
 * So "frames stalled while timers are alive" means the player cannot see the
 * table. If the main thread itself was busy (a long task), frames and timers
 * stall together and the click is let through — the screen was still showing
 * the last frame. Any press or click that arrives during a real paint stall is
 * swallowed in the capture phase, before React sees it, and the player is told
 * to look again once the screen is back.
 */

import { hasValue } from "./guards";

/** No painted frame for this long while the tab is visible and timers are running = the player can't see the table. */
export const RENDER_STALL_THRESHOLD_MS = 300;

/** Timer heartbeat; a heartbeat older than HEARTBEAT_FRESH_MS means the main thread was blocked, not the GPU. */
const HEARTBEAT_INTERVAL_MS = 50;
const HEARTBEAT_FRESH_MS = 200;

/** A press blocked at pointerdown also blocks its matching click, even if frames resume in between. */
const BLOCKED_GESTURE_WINDOW_MS = 1500;

/**
 * True when no frame has been painted for over `threshold` while timers kept
 * running (`lastHeartbeatAt` is fresh), i.e. the page is alive but not visible.
 */
export function isRenderStalled(lastFrameAt: number, lastHeartbeatAt: number, now: number, threshold: number = RENDER_STALL_THRESHOLD_MS): boolean {
    const framesStalled = now - lastFrameAt > threshold;
    const mainThreadAlive = now - lastHeartbeatAt <= HEARTBEAT_FRESH_MS;
    return framesStalled && mainThreadAlive;
}

/**
 * Starts the frame watchdog and the capture-phase input filter on `win`.
 * `onBlocked` runs once per swallowed gesture. Returns the teardown.
 */
export function installBlindClickGuard(win: Window, onBlocked: () => void): () => void {
    const now = () => win.performance.now();
    let lastFrameAt = now();
    let lastHeartbeatAt = now();
    let blockedGestureUntil = 0;
    let frameId: number | undefined;

    const heartbeatId = win.setInterval(() => {
        lastHeartbeatAt = now();
    }, HEARTBEAT_INTERVAL_MS);

    const tick = () => {
        lastFrameAt = now();
        frameId = win.requestAnimationFrame(tick);
    };
    frameId = win.requestAnimationFrame(tick);

    // Hidden tabs get no frames by design; coming back must not look like a stall.
    const onVisibilityChange = () => {
        if (win.document.visibilityState === "visible") {
            lastFrameAt = now();
            lastHeartbeatAt = now();
        }
    };

    const swallow = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const onPress = (event: Event) => {
        const t = now();
        // pointerdown and its compatibility mousedown are one press: report it once.
        if (t < blockedGestureUntil) {
            swallow(event);
            return;
        }
        if (win.document.visibilityState === "visible" && isRenderStalled(lastFrameAt, lastHeartbeatAt, t)) {
            blockedGestureUntil = t + BLOCKED_GESTURE_WINDOW_MS;
            swallow(event);
            onBlocked();
        }
    };

    const onClick = (event: Event) => {
        const t = now();
        if (t < blockedGestureUntil) {
            blockedGestureUntil = 0;
            swallow(event);
            return;
        }
        // A click with no preceding pointerdown (keyboard activation).
        if (win.document.visibilityState === "visible" && isRenderStalled(lastFrameAt, lastHeartbeatAt, t)) {
            swallow(event);
            onBlocked();
        }
    };

    const options: AddEventListenerOptions = { capture: true };
    win.document.addEventListener("visibilitychange", onVisibilityChange);
    win.addEventListener("pointerdown", onPress, options);
    win.addEventListener("mousedown", onPress, options);
    win.addEventListener("click", onClick, options);

    return () => {
        if (hasValue(frameId)) {
            win.cancelAnimationFrame(frameId);
        }
        win.clearInterval(heartbeatId);
        win.document.removeEventListener("visibilitychange", onVisibilityChange);
        win.removeEventListener("pointerdown", onPress, options);
        win.removeEventListener("mousedown", onPress, options);
        win.removeEventListener("click", onClick, options);
    };
}
