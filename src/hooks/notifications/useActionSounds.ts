import { useCallback } from "react";

/**
 * Sound file paths for each poker action
 */
const ACTION_SOUND_PATHS = {
    "all-in": "/sounds/all-in.mp3",
    bet: "/sounds/bet-raise.mp3",
    raise: "/sounds/bet-raise.mp3",
    call: "/sounds/call.mp3",
    check: "/sounds/check.mp3",
    fold: "/sounds/fold.wav",
    muck: "/sounds/fold.wav",
    show: "/sounds/show.mp3"
} as const;

type ActionSoundKey = keyof typeof ACTION_SOUND_PATHS;

/**
 * Default volume for action sounds
 */
const DEFAULT_VOLUME = 0.5;

/**
 * Custom hook to play sounds when poker actions are performed.
 *
 * Plays a distinct audio cue for each player action:
 * - All-in: chip slam sound
 * - Bet & Raise: chip toss sound
 * - Call: chip call sound
 * - Check: check tap sound
 * - Fold & Muck: card fold sound
 * - Show: card reveal sound
 *
 * @param options - Configuration options
 * @param options.volume - Volume level from 0 to 1 (default: 0.5)
 * @returns Object with `playActionSound` function
 */
export const useActionSounds = (options: { volume?: number } = {}) => {
    const volume = Math.max(0, Math.min(1, options.volume ?? DEFAULT_VOLUME));

    const playActionSound = useCallback(
        (action: string) => {
            const soundPath = ACTION_SOUND_PATHS[action as ActionSoundKey];
            if (!soundPath) return;

            try {
                const audio = new Audio(soundPath);
                audio.volume = volume;
                audio.play().catch(() => {
                    // Audio playback failed — ignore silently (e.g. autoplay policy)
                });
            } catch {
                // Audio creation failed — ignore silently
            }
        },
        [volume]
    );

    return { playActionSound };
};
