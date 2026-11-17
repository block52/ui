/**
 * remoteActionSound decorator (WS Action Bus, Phase 3 — plan §2.4).
 *
 * For every `playerActed` event performed by a NON-local player, attach a sound
 * hint whose `kind` is the resolved sound key (getActionSoundKey). This replaces
 * the `lastPlayedIndexRef`/`lastHandNumberRef` diffing in useGameStateSounds:
 * the bus already derives one `playerActed` per new action with a persistent,
 * globally-monotonic index baseline, so there is no replay on rollover/resubscribe
 * and duplicate frames derive nothing.
 *
 * Local-player actions are skipped: PokerActionPanel already plays a sound
 * optimistically on click, so echoing the WS commit would double it.
 *
 * Because the local address is runtime state (localStorage), this is a FACTORY —
 * `makeRemoteActionSound(getLocalAddress)` closes over the accessor and returns a
 * pure decorator, keeping the decorator itself trivially unit-testable with an
 * injected address.
 */
import type { Decorator, Decoration, SoundHint } from "../types";
import { getActionSoundKey } from "../../utils/actionSoundUtils";
import { hasElements } from "../../utils/guards";

export function makeRemoteActionSound(getLocalAddress: () => string | null): Decorator {
    return (item): Partial<Decoration> => {
        const localAddress = getLocalAddress();
        const sounds: SoundHint[] = [];
        for (const event of item.events) {
            if (event.type !== "playerActed") {
                continue;
            }
            const action = event.action;
            // Skip the local player's own echo (already sounded on click).
            if (localAddress && action.playerId === localAddress) {
                continue;
            }
            const soundKey = getActionSoundKey(action.action);
            if (soundKey) {
                sounds.push({ kind: soundKey, seat: action.seat });
            }
        }
        return hasElements(sounds) ? { sounds } : {};
    };
}
