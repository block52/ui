import { useEffect, useRef } from "react";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { useActionSounds } from "./useActionSounds";

/**
 * Gap between the sounds of one committed frame. Long enough to hear two
 * actions as two, short enough that a three-action frame is done in a quarter
 * of a second.
 */
export const SOUND_STAGGER_MS = 120;

/**
 * Most sounds played for one frame. A chain frame routinely carries 2-3 actions
 * (two opponents in one block, a forced timeout, a runout); a reconnect
 * re-snapshot can derive far more, and replaying those would be a burst of noise
 * about actions the table has already moved past. Keep the NEWEST ones.
 */
export const MAX_SOUNDS_PER_FRAME = 4;

/**
 * Plays action sounds for ALL players at the table by watching the shared game state.
 *
 * Unlike useActionSounds (which only triggers when the *local* user clicks a button),
 * this hook plays the appropriate sound whenever a new action is committed —
 * regardless of which player performed it.
 *
 * Driven by the WS Action Bus: the `remoteActionSound` decorator resolves the
 * sounds (skipping the local player and mapping via getActionSoundKey) at ingest,
 * so this hook plays the `decoration.sounds` hints of each committed item — sound
 * stays synced with the visual commit (plan open-question 1: sounds fire at
 * commit, not ingest).
 *
 * EVERY hint in a frame sounds, in index order, SOUND_STAGGER_MS apart (ui#624).
 * It used to play only the newest, so in a multi-action frame the earlier
 * actions were silent and the one sound you heard could belong to a different
 * action than the one you were looking at.
 *
 * Mount this once inside the Table component.
 *
 * NOTE: Actions from the local player are skipped (by the decorator) because
 * PokerActionPanel already plays a sound on button click (optimistic). Playing
 * again on the WebSocket echo would sound every local action twice.
 *
 * @param enabled - Whether sounds are enabled (driven by GameSettings playerActionSounds)
 */
export const useGameStateSounds = (enabled: boolean): void => {
    const { latestItem } = useGameEventsContext();
    const { playActionSound } = useActionSounds({ preload: enabled });

    // Pending staggered plays. Deliberately NOT cleared when the next frame
    // commits: a frame arriving inside the stagger window must not swallow the
    // previous frame's remaining sounds (the ui#605 class of bug — an effect
    // cleanup cancelling the timer it just set). They die only on unmount or
    // when sounds are switched off.
    const pendingRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    useEffect(() => {
        if (!enabled || !latestItem) return;

        // Index-ordered by the decorator, so array order is action order. An
        // empty array means "nothing to sound" (e.g. a local-only action).
        const soundHints = latestItem.decoration.sounds.slice(-MAX_SOUNDS_PER_FRAME);
        soundHints.forEach((hint, position) => {
            if (position === 0) {
                // The first sound is synchronous: a single-action frame — the
                // common case — must not pay a timer tick.
                playActionSound(hint.kind);
                return;
            }
            const pending = pendingRef.current;
            const timer = setTimeout(() => {
                pending.delete(timer);
                playActionSound(hint.kind);
            }, position * SOUND_STAGGER_MS);
            pending.add(timer);
        });
    }, [latestItem, enabled, playActionSound]);

    useEffect(() => {
        const pending = pendingRef.current;
        const cancelPending = () => {
            pending.forEach(clearTimeout);
            pending.clear();
        };
        if (!enabled) {
            cancelPending();
        }
        return cancelPending;
    }, [enabled]);
};
