import { useCallback, useMemo, useState } from "react";
import { ETH_CHAIN_ID } from "../../config/constants";
import { normalizeIpfsUri, isAllowedAvatarUrl } from "../../utils/profile/ipfs";
import type { WalletNftAsset } from "../../types/profile/avatar";

interface ProfileNftConfig {
    chainId: number;
    indexerUrlTemplate: string;
    fallbackAlchemyUrl: string;
}

const getProfileNftConfig = (): ProfileNftConfig => {
    return {
        chainId: Number(import.meta.env.VITE_PROFILE_NFT_CHAIN_ID || ETH_CHAIN_ID),
        indexerUrlTemplate: import.meta.env.VITE_PROFILE_NFT_INDEXER_URL || "",
        fallbackAlchemyUrl: import.meta.env.VITE_MAINNET_RPC_URL || ""
    };
};

const PROFILE_NFT_CONFIG = getProfileNftConfig();

interface IndexerNftItem {
    contract?: {
        address?: string;
    };
    tokenId?: string;
    id?: {
        tokenId?: string;
    };
    name?: string;
    title?: string;
    collection?: {
        name?: string;
    };
    metadata?: {
        image?: string;
    };
    image?: {
        cachedUrl?: string;
        thumbnailUrl?: string;
        pngUrl?: string;
        originalUrl?: string;
    };
    raw?: {
        metadata?: {
            image?: string;
        };
    };
    rawMetadata?: {
        image?: string;
    };
}

interface IndexerResponse {
    ownedNfts?: IndexerNftItem[];
    nfts?: IndexerNftItem[];
    pageKey?: string;
    nextPageKey?: string;
    nextToken?: string;
    cursor?: string;
}

const MAX_INDEXER_PAGES = 20;
const NFT_LOG_PREFIX = "[ProfileNFT]";

const resolveIndexerUrl = (walletAddress: string, chainId: number): string => {
    const trimmedTemplate = PROFILE_NFT_CONFIG.indexerUrlTemplate.trim();
    if (trimmedTemplate) {
        return trimmedTemplate
            .replace(/\{owner\}/g, walletAddress)
            .replace(/\{chainId\}/g, chainId.toString());
    }

    const alchemyMatch = PROFILE_NFT_CONFIG.fallbackAlchemyUrl.match(/\/v2\/([^/]+)$/);
    if (!alchemyMatch) {
        return "";
    }

    const apiKey = alchemyMatch[1];
    const host = PROFILE_NFT_CONFIG.fallbackAlchemyUrl.replace(/\/v2\/[^/]+$/, "");
    return `${host}/nft/v3/${apiKey}/getNFTsForOwner?owner=${walletAddress}&withMetadata=true&pageSize=100`;
};

const normalizeTokenId = (tokenId: string): string => {
    if (!tokenId) {
        return "";
    }

    if (tokenId.startsWith("0x")) {
        try {
            return BigInt(tokenId).toString();
        } catch {
            return tokenId;
        }
    }

    return tokenId;
};

export const useWalletNfts = (walletAddress: string | undefined, isConnected: boolean | null) => {
    const [walletNfts, setWalletNfts] = useState<WalletNftAsset[]>([]);
    const [isLoadingNfts, setIsLoadingNfts] = useState(false);
    const [nftsError, setNftsError] = useState<string | null>(null);
    const [nftsWarning, setNftsWarning] = useState<string | null>(null);

    const hasIndexerConfigured = useMemo(() => {
        return PROFILE_NFT_CONFIG.indexerUrlTemplate.trim().length > 0 || PROFILE_NFT_CONFIG.fallbackAlchemyUrl.trim().length > 0;
    }, []);
    const hasSourceConfigured = hasIndexerConfigured;

    const mapIndexerItems = useCallback((items: IndexerNftItem[]): WalletNftAsset[] => {
        return items
            .map((item: IndexerNftItem): WalletNftAsset | null => {
                const contractAddress = item.contract?.address || "";
                const rawTokenId = item.tokenId || item.id?.tokenId || "";
                const tokenId = normalizeTokenId(rawTokenId);

                if (!contractAddress || !tokenId) {
                    return null;
                }

                const rawImage = item.image?.cachedUrl || item.image?.thumbnailUrl || item.image?.pngUrl || item.image?.originalUrl || item.metadata?.image || item.rawMetadata?.image || item.raw?.metadata?.image || "";
                const imageUrl = normalizeIpfsUri(rawImage);

                if (!isAllowedAvatarUrl(imageUrl)) {
                    return null;
                }

                return {
                    id: `${contractAddress}:${tokenId}`,
                    contractAddress,
                    tokenId,
                    imageUrl,
                    name: item.name || item.title,
                    collectionName: item.collection?.name
                };
            })
            .filter((asset): asset is WalletNftAsset => Boolean(asset));
    }, []);

    const getNextPageToken = useCallback((response: IndexerResponse): string | null => {
        return response.pageKey || response.nextPageKey || response.nextToken || response.cursor || null;
    }, []);

    const fetchAllWalletNfts = useCallback(async (address: string): Promise<WalletNftAsset[]> => {
        const indexerUrl = resolveIndexerUrl(address, PROFILE_NFT_CONFIG.chainId);
        if (!indexerUrl) {
            throw new Error("No NFT indexer configured.");
        }

        const dedupedAssets = new Map<string, WalletNftAsset>();
        let nextPageToken: string | null = null;

        for (let pageIndex = 0; pageIndex < MAX_INDEXER_PAGES; pageIndex += 1) {
            const pageUrl = new URL(indexerUrl);
            if (nextPageToken) {
                pageUrl.searchParams.set("pageKey", nextPageToken);
            }

            const response = await fetch(pageUrl.toString());
            if (!response.ok) {
                throw new Error("Failed to fetch wallet NFTs from indexer.");
            }

            const data = (await response.json()) as IndexerResponse;
            const items = data.ownedNfts || data.nfts || [];
            const mappedItems = mapIndexerItems(items);

            for (const asset of mappedItems) {
                dedupedAssets.set(asset.id, asset);
            }

            nextPageToken = getNextPageToken(data);
            if (!nextPageToken) {
                break;
            }
        }

        if (nextPageToken) {
            console.error(`${NFT_LOG_PREFIX} Pagination limit reached at ${MAX_INDEXER_PAGES} pages; results may be partial.`);
        }

        return Array.from(dedupedAssets.values());
    }, [getNextPageToken, mapIndexerItems]);

    const refreshWalletNfts = useCallback(async () => {
        if (!isConnected || !walletAddress) {
            setWalletNfts([]);
            setNftsError(null);
            setNftsWarning(null);
            return;
        }

        if (!hasSourceConfigured) {
            const missingConfigError = "No NFT indexer configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_MAINNET_RPC_URL.";
            console.error(`${NFT_LOG_PREFIX} Missing source config`);
            setWalletNfts([]);
            setNftsError(missingConfigError);
            setNftsWarning(null);
            return;
        }

        setIsLoadingNfts(true);
        setNftsError(null);
        setNftsWarning(null);

        try {
            const nftResults = await fetchAllWalletNfts(walletAddress);
            setWalletNfts(nftResults);
            setNftsWarning(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load wallet NFTs.";
            console.error(`${NFT_LOG_PREFIX} Error loading wallet NFTs (address=${walletAddress}):`, error);
            setWalletNfts([]);
            setNftsError(errorMessage);
            setNftsWarning(null);
        } finally {
            setIsLoadingNfts(false);
        }
    }, [fetchAllWalletNfts, hasSourceConfigured, isConnected, walletAddress]);

    return {
        walletNfts,
        isLoadingNfts,
        nftsError,
        nftsWarning,
        refreshWalletNfts,
        hasSourceConfigured
    };
};

export default useWalletNfts;
