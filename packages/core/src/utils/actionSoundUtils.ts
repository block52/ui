import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";

/**
 * Maps a PlayerActionType to the corresponding sound key used by useActionSounds.
 * Returns null for actions that have no associated sound (including all NonPlayerActionType).
 *
 * Blind posts are SILENT (ui#624). They used to map to "check", so an opponent
 * posting a blind sounded like a check on every hand — and with engine-driven
 * hand starts both posts arrive in the new-hand frame, opening every hand with a
 * phantom check. There is no dedicated chip sound for a post on the CDN yet;
 * silence also matches the local player, whose own blind post never sounded.
 */
export function getActionSoundKey(action: PlayerActionType | NonPlayerActionType): string | null {
    switch (action) {
        case PlayerActionType.FOLD:
            return "fold";
        case PlayerActionType.CALL:
            return "call";
        case PlayerActionType.CHECK:
            return "check";
        case PlayerActionType.SMALL_BLIND:
        case PlayerActionType.BIG_BLIND:
            return null;
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
