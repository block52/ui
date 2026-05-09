import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";

/**
 * Maps a PlayerActionType to the corresponding sound key used by useActionSounds.
 * Returns null for actions that have no associated sound (including all NonPlayerActionType).
 */
export function getActionSoundKey(action: PlayerActionType | NonPlayerActionType): string | null {
    switch (action) {
        case PlayerActionType.FOLD:
            return "fold";
        case PlayerActionType.CALL:
            return "call";
        case PlayerActionType.CHECK:
        case PlayerActionType.SMALL_BLIND:
        case PlayerActionType.BIG_BLIND:
            return "check";
        case PlayerActionType.BET:
            return "bet";
        case PlayerActionType.RAISE:
            return "raise";
        case PlayerActionType.ALL_IN:
            return "all-in";
        case PlayerActionType.MUCK:
            return "muck";
        case PlayerActionType.SHOW:
            return "show";
        default:
            return null;
    }
}
