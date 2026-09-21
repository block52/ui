import { useCallback, useEffect } from "react";
import { getSoundUrl } from "../../utils/cardImages";
import { getActionSoundPlayer } from "../../audio/actionSoundPlayer";

/**
 * Sound file paths for each poker action
 */
const ACTION_SOUND_PATHS: Record<string, string | null> = {
    "all-in": getSoundUrl("all-in.mp3"),
    bet: getSoundUrl("bet-raise.mp3"),
    raise: getSoundUrl("bet-raise.mp3"),
    call: getSoundUrl("call.mp3"),
    check: getSoundUrl("check.mp3"),
    fold: getSoundUrl("fold.mp3"),
    muck: null,
    show: getSoundUrl("show.mp3")
};

type ActionSoundKey = keyof typeof ACTION_SOUND_PATHS;

/** Every distinct sound file, for preloading (bet + raise share one). */
const ACTION_SOUND_URLS: readonly string[] = [...new Set(Object.values(ACTION_SOUND_PATHS).filter((url): url is string => !!url))];

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
 * Sounds are PRELOADED and played through the shared ActionSoundPlayer (ui#624):
 * decoded once into Web Audio buffers, with a pooled <audio preload="auto">
 * fallback. A play no longer fetches from the CDN or builds a new element.
 *
 * @param options - Configuration options
 * @param options.volume - Volume level from 0 to 1 (default: 0.5)
 * @param options.preload - Warm the sounds on mount (default: true). Pass the
 *   player's "action sounds" setting so nothing is fetched while they are off.
 * @returns Object with `playActionSound` function
 */
export const useActionSounds = (options: { volume?: number; preload?: boolean } = {}) => {
    const volume = Math.max(0, Math.min(1, options.volume ?? DEFAULT_VOLUME));
    const preload = options.preload ?? true;

    useEffect(() => {
        if (preload) {
            getActionSoundPlayer().preload(ACTION_SOUND_URLS);
        }
    }, [preload]);

    const playActionSound = useCallback(
        (action: string) => {
            const soundPath = ACTION_SOUND_PATHS[action as ActionSoundKey];
            if (!soundPath) return;

            // Never throws: a sound that cannot play is dropped (autoplay policy,
            // decode error, no audio device).
            getActionSoundPlayer().play(soundPath, volume);
        },
        [volume]
    );

    return { playActionSound };
};
