import { ipfsCandidateUrls, isAllowedAvatarUrl, toCanonicalIpfsUri } from "./ipfs";

const NFT_AVATAR_PATTERN = /^nft:eip155:(\d+)\/erc721:(0x[a-fA-F0-9]{40})\/([^|]+)\|(.+)$/;

export interface ParsedPlayerAvatar {
    chainId?: number;
    contractAddress?: string;
    tokenId?: string;
    /** The URL to try first — `avatarUrlCandidates[0]`. */
    avatarUrl: string;
    /**
     * Every URL worth trying, highest priority first (ui#625). For an IPFS
     * avatar that is one entry per configured gateway, so a renderer can step
     * to the next one when a gateway refuses the image instead of giving up.
     */
    avatarUrlCandidates: string[];
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
    // ui#625: store the CONTENT ADDRESS, never a gateway URL. This payload is
    // written to chain state by MsgRegisterNftAvatar and we cannot rewrite it
    // afterwards — baking `https://<some gateway>/ipfs/…` in made every viewer
    // of every table a client of that one gateway, forever.
    const canonicalImageUrl = toCanonicalIpfsUri(imageUrl);
    return `nft:eip155:${chainId}/erc721:${contractAddress}/${tokenId}|${canonicalImageUrl}`;
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
        // Already-registered avatars carry a gateway URL; parsing them back to
        // the content address is what lets them survive a gateway change.
        const avatarUrlCandidates = ipfsCandidateUrls(nftMatch[4]);
        const avatarUrl = avatarUrlCandidates[0] ?? "";

        if (!Number.isFinite(chainId) || !isAllowedAvatarUrl(avatarUrl)) {
            return null;
        }

        return {
            chainId,
            contractAddress,
            tokenId,
            avatarUrl,
            avatarUrlCandidates,
            format: "nft"
        };
    }

    const directCandidates = ipfsCandidateUrls(trimmedValue);
    const directAvatarUrl = directCandidates[0] ?? "";
    if (!isAllowedAvatarUrl(directAvatarUrl)) {
        return null;
    }

    return {
        avatarUrl: directAvatarUrl,
        avatarUrlCandidates: directCandidates,
        format: "url"
    };
};
