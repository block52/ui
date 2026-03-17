import { useCallback, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { ETH_CHAIN_ID } from "../../config/constants";
import { nftProfileABI } from "../../abis/nftProfileABI";
import { normalizeIpfsUri, isAllowedAvatarUrl } from "../../utils/profile/ipfs";
import type { ProfileNftSourceMode, WalletNftAsset } from "../../types/profile/avatar";

const PROFILE_NFT_CONTRACTS = (import.meta.env.VITE_PROFILE_NFT_CONTRACTS || "")
    .split(",")
    .map((value: string) => value.trim())
    .filter((value: string) => value.length > 0);

const PROFILE_NFT_SOURCE_MODE = (import.meta.env.VITE_PROFILE_NFT_SOURCE_MODE || "all") as ProfileNftSourceMode;

const PROFILE_NFT_CHAIN_ID = Number(import.meta.env.VITE_PROFILE_NFT_CHAIN_ID || ETH_CHAIN_ID);
const PROFILE_NFT_INDEXER_URL_TEMPLATE = import.meta.env.VITE_PROFILE_NFT_INDEXER_URL || "";
const FALLBACK_ALCHEMY_URL = import.meta.env.VITE_ALCHEMY_URL || "";

type TokenMetadata = {
    image?: string;
    name?: string;
};

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
    const trimmedTemplate = PROFILE_NFT_INDEXER_URL_TEMPLATE.trim();
    if (trimmedTemplate) {
        return trimmedTemplate
            .replaceAll("{owner}", walletAddress)
            .replaceAll("{chainId}", chainId.toString());
    }

    const alchemyMatch = FALLBACK_ALCHEMY_URL.match(/\/v2\/([^/]+)$/);
    if (!alchemyMatch) {
        return "";
    }

    const apiKey = alchemyMatch[1];
    const host = FALLBACK_ALCHEMY_URL.replace(/\/v2\/[^/]+$/, "");
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

const readCollectionName = async (
    publicClient: ReturnType<typeof usePublicClient>,
    contractAddress: `0x${string}`
): Promise<string | undefined> => {
    if (!publicClient) {
        return undefined;
    }

    try {
        const name = await publicClient.readContract({
            abi: nftProfileABI,
            address: contractAddress,
            functionName: "name"
        });

        return typeof name === "string" ? name : undefined;
    } catch {
        return undefined;
    }
};

const fetchTokenMetadata = async (tokenUri: string): Promise<TokenMetadata | null> => {
    const normalizedUri = normalizeIpfsUri(tokenUri);
    if (!normalizedUri) {
        return null;
    }

    try {
        const response = await fetch(normalizedUri);
        if (!response.ok) {
            return null;
        }

        const metadata = (await response.json()) as TokenMetadata;
        return metadata;
    } catch {
        return null;
    }
};

export const useWalletNfts = (walletAddress: string | undefined, isConnected: boolean | null) => {
    const publicClient = usePublicClient({ chainId: PROFILE_NFT_CHAIN_ID });
    const [walletNfts, setWalletNfts] = useState<WalletNftAsset[]>([]);
    const [isLoadingNfts, setIsLoadingNfts] = useState(false);
    const [nftsError, setNftsError] = useState<string | null>(null);
    const [nftsWarning, setNftsWarning] = useState<string | null>(null);

    const sourceMode = useMemo<ProfileNftSourceMode>(() => {
        return PROFILE_NFT_SOURCE_MODE === "collections" ? "collections" : "all";
    }, []);

    const hasContractsConfigured = useMemo(() => PROFILE_NFT_CONTRACTS.length > 0, []);
    const hasIndexerConfigured = useMemo(() => {
        return PROFILE_NFT_INDEXER_URL_TEMPLATE.trim().length > 0 || FALLBACK_ALCHEMY_URL.trim().length > 0;
    }, []);
    const hasSourceConfigured = useMemo(() => {
        return sourceMode === "collections" ? hasContractsConfigured : hasIndexerConfigured;
    }, [sourceMode, hasContractsConfigured, hasIndexerConfigured]);

    const mapIndexerItems = useCallback((items: IndexerNftItem[]): WalletNftAsset[] => {
        return items
            .map((item: IndexerNftItem): WalletNftAsset | null => {
                const contractAddress = item.contract?.address || "";
                const rawTokenId = item.tokenId || item.id?.tokenId || "";
                const tokenId = normalizeTokenId(rawTokenId);

                if (!contractAddress || !tokenId) {
                    return null;
                }

                const rawImage = item.image?.cachedUrl || item.image?.pngUrl || item.image?.originalUrl || item.metadata?.image || item.rawMetadata?.image || item.raw?.metadata?.image || "";
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
        const indexerUrl = resolveIndexerUrl(address, PROFILE_NFT_CHAIN_ID);
        if (!indexerUrl) {
            throw new Error("No NFT indexer configured for all-wallet NFT mode.");
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

    const fetchConfiguredCollectionNfts = useCallback(async (address: string): Promise<{ assets: WalletNftAsset[]; warning: string | null }> => {
        if (!publicClient) {
            throw new Error("Wallet provider is not ready yet.");
        }

        if (!hasContractsConfigured) {
            throw new Error("No NFT contracts configured for profile avatars.");
        }

        const nftResults: WalletNftAsset[] = [];
    const nonEnumerableContracts: string[] = [];

        for (const contract of PROFILE_NFT_CONTRACTS) {
            const contractAddress = contract as `0x${string}`;

            let balance = 0;
            try {
                const balanceRaw = await publicClient.readContract({
                    abi: nftProfileABI,
                    address: contractAddress,
                    functionName: "balanceOf",
                    args: [address as `0x${string}`]
                });
                balance = Number(balanceRaw);
            } catch {
                continue;
            }

            if (balance <= 0) {
                continue;
            }

            const collectionName = await readCollectionName(publicClient, contractAddress);

            for (let index = 0; index < balance; index += 1) {
                let tokenId: string;

                try {
                    const tokenIdRaw = await publicClient.readContract({
                        abi: nftProfileABI,
                        address: contractAddress,
                        functionName: "tokenOfOwnerByIndex",
                        args: [address as `0x${string}`, BigInt(index)]
                    });

                    tokenId = tokenIdRaw.toString();
                } catch {
                    if (index === 0) {
                        nonEnumerableContracts.push(contractAddress);
                        break;
                    }

                    continue;
                }

                try {
                    const tokenUriRaw = await publicClient.readContract({
                        abi: nftProfileABI,
                        address: contractAddress,
                        functionName: "tokenURI",
                        args: [BigInt(tokenId)]
                    });

                    const tokenMetadata = await fetchTokenMetadata(tokenUriRaw as string);
                    const imageUrl = normalizeIpfsUri(tokenMetadata?.image || "");

                    if (!isAllowedAvatarUrl(imageUrl)) {
                        continue;
                    }

                    nftResults.push({
                        id: `${contractAddress}:${tokenId}`,
                        contractAddress,
                        tokenId,
                        imageUrl,
                        name: tokenMetadata?.name,
                        collectionName
                    });
                } catch {
                    continue;
                }
            }
        }

        const warning = nonEnumerableContracts.length > 0
            ? `Some configured collections do not support ERC721Enumerable and cannot be scanned in collections mode: ${nonEnumerableContracts.join(", ")}.`
            : null;

        return {
            assets: nftResults,
            warning
        };
    }, [hasContractsConfigured, publicClient]);

    const refreshWalletNfts = useCallback(async () => {
        if (!isConnected || !walletAddress) {
            setWalletNfts([]);
            setNftsError(null);
            setNftsWarning(null);
            return;
        }

        if (!hasSourceConfigured) {
            const missingConfigError =
                sourceMode === "collections"
                    ? "No NFT contracts configured for profile avatars."
                    : "No NFT indexer configured for all-wallet NFT mode.";

            console.error(`${NFT_LOG_PREFIX} Missing source config for mode=${sourceMode}`);
            setWalletNfts([]);
            setNftsError(missingConfigError);
            setNftsWarning(null);
            return;
        }

        setIsLoadingNfts(true);
        setNftsError(null);
        setNftsWarning(null);

        try {
            if (sourceMode === "all") {
                const nftResults = await fetchAllWalletNfts(walletAddress);
                setWalletNfts(nftResults);
                setNftsWarning(null);
            } else {
                const { assets, warning } = await fetchConfiguredCollectionNfts(walletAddress);
                setWalletNfts(assets);
                setNftsWarning(warning);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load wallet NFTs.";
            console.error(`${NFT_LOG_PREFIX} Error loading wallet NFTs (mode=${sourceMode}, address=${walletAddress}):`, error);
            setWalletNfts([]);
            setNftsError(errorMessage);
            setNftsWarning(null);
        } finally {
            setIsLoadingNfts(false);
        }
    }, [fetchAllWalletNfts, fetchConfiguredCollectionNfts, hasSourceConfigured, isConnected, sourceMode, walletAddress]);

    return {
        walletNfts,
        isLoadingNfts,
        nftsError,
        nftsWarning,
        refreshWalletNfts,
        hasContractsConfigured,
        hasSourceConfigured,
        sourceMode
    };
};

export default useWalletNfts;
