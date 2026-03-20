import { ETH_CHAIN_ID } from "../../config/constants";
import type { AvatarSelection, AvatarSelectionStorageV1 } from "../../types/profile/avatar";

const STORAGE_PREFIX = "profile_avatar_selection";

const normalizeAddress = (address: string): string => address.toLowerCase();

const buildStorageKey = (chainId: number, walletAddress: string): string => {
    return `${STORAGE_PREFIX}:${chainId}:${normalizeAddress(walletAddress)}`;
};

const parseStorageRecord = (raw: string): AvatarSelectionStorageV1 | null => {
    try {
        const parsed = JSON.parse(raw) as AvatarSelectionStorageV1;
        if (parsed.version !== 1) {
            return null;
        }

        if (!parsed.selection?.imageUrl || !parsed.walletAddress) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

export const getStoredAvatarSelection = (walletAddress: string, chainId: number = ETH_CHAIN_ID): AvatarSelection | null => {
    const raw = localStorage.getItem(buildStorageKey(chainId, walletAddress));
    if (!raw) {
        return null;
    }

    const parsed = parseStorageRecord(raw);
    return parsed?.selection ?? null;
};

export const setStoredAvatarSelection = (
    walletAddress: string,
    selection: AvatarSelection,
    chainId: number = ETH_CHAIN_ID
): void => {
    const record: AvatarSelectionStorageV1 = {
        version: 1,
        chainId,
        walletAddress: normalizeAddress(walletAddress),
        selection
    };

    localStorage.setItem(buildStorageKey(chainId, walletAddress), JSON.stringify(record));
};

export const clearStoredAvatarSelection = (walletAddress: string, chainId: number = ETH_CHAIN_ID): void => {
    localStorage.removeItem(buildStorageKey(chainId, walletAddress));
};

export const getStoredAvatarSelectionForAddress = (walletAddress: string): AvatarSelection | null => {
    const normalized = normalizeAddress(walletAddress);

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(`${STORAGE_PREFIX}:`)) {
            continue;
        }

        const parts = key.split(":");
        const storedAddress = parts[parts.length - 1];
        if (storedAddress !== normalized) {
            continue;
        }

        const raw = localStorage.getItem(key);
        if (!raw) {
            continue;
        }

        const parsed = parseStorageRecord(raw);
        if (parsed?.selection) {
            return parsed.selection;
        }
    }

    return null;
};
