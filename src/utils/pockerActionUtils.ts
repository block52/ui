import { PlayerDTO } from "@block52/poker-vm-sdk";

export const userInTable = (players: PlayerDTO[] | null, userAddress: string | null | undefined): boolean => {
    if (!players || !userAddress) return false;
    return players.some((player: PlayerDTO) => player.address?.toLowerCase() === userAddress.toLowerCase());
};

export const getUserPlayer = (players: PlayerDTO[] | null, userAddress: string | null | undefined): PlayerDTO | null => {
    if (!players || !userAddress) return null;
    return players.find((player: PlayerDTO) => player.address?.toLowerCase() === userAddress.toLowerCase()) || null;
};
