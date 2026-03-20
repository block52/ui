import { isAllowedAvatarUrl, normalizeIpfsUri } from "./ipfs";

const NFT_AVATAR_PATTERN = /^nft:eip155:(\d+)\/erc721:(0x[a-fA-F0-9]{40})\/([^|]+)\|(.+)$/;

export interface ParsedPlayerAvatar {
    chainId?: number;
    contractAddress?: string;
    tokenId?: string;
    avatarUrl: string;
    format: "nft" | "url";
}

interface BuildPlayerAvatarInput {
    chainId: number;
    contractAddress: string;
    tokenId: string;
    imageUrl: string;
}

export const buildPlayerAvatar = ({
    chainId,
    contractAddress,
    tokenId,
    imageUrl
}: BuildPlayerAvatarInput): string => {
    const normalizedImageUrl = normalizeIpfsUri(imageUrl);
    return `nft:eip155:${chainId}/erc721:${contractAddress}/${tokenId}|${normalizedImageUrl}`;
};

export const parsePlayerAvatar = (value: string | undefined | null): ParsedPlayerAvatar | null => {
    if (!value) {
        return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    const nftMatch = trimmedValue.match(NFT_AVATAR_PATTERN);
    if (nftMatch) {
        const chainId = Number(nftMatch[1]);
        const contractAddress = nftMatch[2];
        const tokenId = nftMatch[3];
        const avatarUrl = normalizeIpfsUri(nftMatch[4]);

        if (!Number.isFinite(chainId) || !isAllowedAvatarUrl(avatarUrl)) {
            return null;
        }

        return {
            chainId,
            contractAddress,
            tokenId,
            avatarUrl,
            format: "nft"
        };
    }

    const directAvatarUrl = normalizeIpfsUri(trimmedValue);
    if (!isAllowedAvatarUrl(directAvatarUrl)) {
        return null;
    }

    return {
        avatarUrl: directAvatarUrl,
        format: "url"
    };
};
