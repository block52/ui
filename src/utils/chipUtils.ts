import { PlayerStatus } from "@block52/poker-vm-sdk";

/**
 * Determine whether a player's chips should be shown on the table
 * based on their current status.
 */
export const shouldShowChips = (status: PlayerStatus): boolean => {
    return (
        status === PlayerStatus.ACTIVE ||
        status === PlayerStatus.ALL_IN ||
        status === PlayerStatus.FOLDED
    );
};
