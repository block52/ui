export interface WalletNftAsset {
    id: string;
    contractAddress: string;
    tokenId: string;
    imageUrl: string;
    name?: string;
    collectionName?: string;
}

export interface AvatarSelection {
    contractAddress: string;
    tokenId: string;
    imageUrl: string;
    name?: string;
    selectedAt: number;
}

export interface AvatarSelectionStorageV1 {
    version: 1;
    chainId: number;
    walletAddress: string;
    selection: AvatarSelection;
}

export interface ProfileAvatarState {
    selectedAvatar: AvatarSelection | null;
    walletNfts: WalletNftAsset[];
    isLoadingNfts: boolean;
    nftsError: string | null;
    nftsWarning: string | null;
}
