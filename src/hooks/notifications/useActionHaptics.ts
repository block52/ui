import { useCallback } from "react";

/**
 * useActionHaptics — a tiny wrapper around the Vibration API for the
 * press-time haptic tick (Approach A of the action-feedback UX plan).
 *
 * Sits beside useActionSounds: where the sound is the audible submit cue, this
 * is the tactile one. Gated by the caller on the `actionHaptics` game setting.
 * `navigator.vibrate` is only implemented on some (mostly Android) mobile
 * browsers; the optional-call + try/catch make it a silent no-op everywhere
 * else, so callers don't need to feature-detect.
 */
export const useActionHaptics = () => {
    const vibrate = useCallback((pattern: number | number[] = 10) => {
        try {
            navigator.vibrate?.(pattern);
        } catch {
            // Vibration unsupported or blocked — ignore silently.
        }
    }, []);

    return { vibrate };
};
