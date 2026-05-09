import { useEffect, useRef } from "react";
import { useGameProgress } from "../game/useGameProgress";
import { useActionSounds } from "./useActionSounds";
import { getCosmosAddressSync } from "../../utils/cosmosAccountUtils";
import { hasElements, hasValue } from "../../utils/guards";
import { getActionSoundKey } from "../../utils/actionSoundUtils";

/**
 * Plays action sounds for ALL players at the table by watching the shared game state.
 *
 * Unlike useActionSounds (which only triggers when the *local* user clicks a button),
 * this hook listens to `previousActions` broadcast via the GameStateContext WebSocket
 * and plays the appropriate sound whenever any new action is appended — regardless of
 * which player performed it.
 *
 * Mount this once inside the Table component.
 *
 * NOTE: Actions from the local player are skipped here because PokerActionPanel
 * already plays a sound on button click (optimistic). Playing again on the WebSocket
 * echo would cause every local action to sound twice.
 *
 * @param enabled - Whether sounds are enabled (driven by GameSettings playerActionSounds)
 */
export const useGameStateSounds = (enabled: boolean): void => {
    const { previousActions, handNumber } = useGameProgress();
    const { playActionSound } = useActionSounds();
    const localAddress = getCosmosAddressSync();

    // Track the last action index we already played a sound for.
    // Initialise to -1 so the first real action (index 0) is always played.
    const lastPlayedIndexRef = useRef<number>(-1);

    // When the hand resets (handNumber changes) we reset tracking so the very
    // first action of the new hand always triggers a sound.
    const lastHandNumberRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;
        if (!hasElements(previousActions)) return;

        // Hand rolled over — reset tracking
        if (hasValue(lastHandNumberRef.current) && lastHandNumberRef.current !== handNumber) {
            lastPlayedIndexRef.current = -1;
        }
        lastHandNumberRef.current = handNumber;

        // Find the highest-index action in the current snapshot
        const latestAction = previousActions.reduce((best, action) =>
            action.index > best.index ? action : best
        );

        // Only play if this is a genuinely new action
        if (latestAction.index <= lastPlayedIndexRef.current) return;

        lastPlayedIndexRef.current = latestAction.index;

        // Skip actions from the local player — PokerActionPanel already plays
        // a sound optimistically on click, so we only fire for other players.
        if (localAddress && latestAction.playerId === localAddress) return;

        const soundKey = getActionSoundKey(latestAction.action);

        if (soundKey) {
            playActionSound(soundKey);
        }
    }, [previousActions, handNumber, enabled, localAddress, playActionSound]);
};
