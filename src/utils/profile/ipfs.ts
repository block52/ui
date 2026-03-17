const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export const normalizeIpfsUri = (value: string | undefined | null): string => {
    if (!value) {
        return "";
    }

    if (value.startsWith("ipfs://")) {
        return value.replace("ipfs://", IPFS_GATEWAY);
    }

    return value;
};

export const isAllowedAvatarUrl = (url: string): boolean => {
    if (!url) {
        return false;
    }

    return url.startsWith("https://") || url.startsWith("http://");
};
