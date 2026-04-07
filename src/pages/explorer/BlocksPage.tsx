import { useState, useEffect, useCallback } from "react";
import { getCosmosClient, clearCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { truncateHash, formatTimestampRelative, formatProposerAddress } from "../../utils/formatUtils";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";

// Define block response type locally to match Cosmos API response
interface CosmosBlockResponse {
    block_id: {
        hash: string;
        parts: { total: number; hash: string };
    };
    block: {
        header: {
            version: { block: string; app: string };
            chain_id: string;
            height: string;
            time: string;
            proposer_address: string;
        };
        data: { txs: string[] };
    };
    sdk_block?: {
        header: {
            height: string;
            time: string;
            proposer_address: string;
        };
        data: { txs: string[] };
    };
}

type CosmosBlock = CosmosBlockResponse;

export default function BlocksPage() {
    const [blocks, setBlocks] = useState<CosmosBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { currentNetwork } = useNetwork();

    const fetchBlocks = useCallback(async () => {
        try {
            setLoading(true);
            const cosmosClient = getCosmosClient({
                rpc: currentNetwork.rpc,
                rest: currentNetwork.rest
            });

            if (!cosmosClient) {
                throw new Error("Block52 client not initialized.");
            }

            const recentBlocks = await cosmosClient.getLatestBlocks(50);
            // Sort blocks by height in descending order (newest first)
            const sortedBlocks = recentBlocks.sort((a, b) =>
                parseInt(b.block.header.height) - parseInt(a.block.header.height)
            );
            setBlocks(sortedBlocks as unknown as CosmosBlock[]);
            setError(null);
        } catch (err: any) {
            // Provide detailed, network-specific error messages
            let errorMessage = "Failed to fetch blocks";
            let suggestion = "";

            // Determine error type and provide helpful guidance
            if (err.message?.includes("timeout")) {
                errorMessage = "Request timeout after 10 seconds";
                if (currentNetwork.name === "Localhost") {
                    suggestion = " - Check if 'ignite chain serve' is running";
                } else {
                    suggestion = " - Production network may be slow. Try localhost for development or retry in a moment";
                }
            } else if (err.code === "ERR_NETWORK" || err.message?.includes("ECONNREFUSED")) {
                errorMessage = `Cannot connect to ${currentNetwork.name}`;
                if (currentNetwork.name === "Localhost") {
                    suggestion = " - Run 'ignite chain serve' in the pokerchain directory";
                } else {
                    suggestion = " - Network may be down. Try selecting a different network";
                }
            } else if (err.response) {
                errorMessage = `Server error: ${err.response.status} - ${err.response.statusText}`;
                suggestion = " - The node may be restarting or under maintenance";
            } else if (err.message) {
                errorMessage = err.message;
            }

            const fullMessage = errorMessage + suggestion;

            // Graceful degradation: Keep old blocks if we have cached data
            if (blocks.length > 0) {
                setError(`⚠️ Network unavailable - showing cached data. ${fullMessage}`);
            } else {
                setError(fullMessage);
                console.error("Error fetching blocks:", err);
            }
        } finally {
            setLoading(false);
        }
    }, [currentNetwork, blocks.length]);

    useEffect(() => {
        // Set page title
        document.title = "Block Explorer - Block52 Chain";

        // Clear client when network changes to force re-initialization
        clearCosmosClient();

        // Initial fetch
        fetchBlocks();

        // Auto-refresh every 10 seconds (reduced frequency to minimize re-renders)
        const interval = setInterval(fetchBlocks, 10000);

        return () => {
            clearInterval(interval);
            // Reset title when component unmounts
            document.title = "Block52 Chain";
        };
    }, [currentNetwork, fetchBlocks]);

    if (loading && blocks.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <AnimatedBackground />
                <div className="bg-gray-800 border border-gray-700 p-8 rounded-lg shadow-2xl text-center relative z-10">
                    <div className="flex justify-center mb-4">
                        <LoadingSpinner size="xl" className="text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Loading blocks...</h2>
                </div>
            </div>
        );
    }

    if (error && blocks.length === 0) {
        return (
            <div className="min-h-screen p-8 relative">
                <AnimatedBackground />
                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Header */}
                    <ExplorerHeader />

                    {/* Error Card */}
                    <div className="flex justify-center">
                        <div className="bg-gray-800 border border-gray-700 p-8 rounded-lg shadow-2xl text-center max-w-lg">
                            <div className="flex justify-center mb-4">
                                <svg className="h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">Error: {error}</h2>
                            <p className="text-gray-300 mb-4">Make sure your Block52 blockchain is running</p>
                            <p className="text-sm text-gray-400 mb-6">Try selecting a different network from the dropdown above</p>

                            {/* Retry Button */}
                            <button
                                onClick={() => fetchBlocks()}
                                disabled={loading}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                            >
                                {loading ? "Retrying..." : "🔄 Retry Connection"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <ExplorerHeader />

                {/* Blocks Table */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Height</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Block Hash</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Transactions</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Proposer</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {blocks.map(block => (
                                    <tr key={block.block.header.height} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-blue-400 font-bold">#{block.block.header.height}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`/explorer/block/${block.block.header.height}`}
                                                className="font-mono text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors break-all block"
                                                title="Click to view block details"
                                            >
                                                {block.block_id.hash}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {block.block.data.txs.length === 0 ? (
                                                <span className="text-gray-400">0 txs</span>
                                            ) : (
                                                <span className="text-green-400 font-semibold">
                                                    {block.block.data.txs.length} tx{block.block.data.txs.length > 1 ? "s" : ""}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-mono text-xs text-blue-400" title={block.block.header.proposer_address || ""}>
                                                {truncateHash(formatProposerAddress(block.block.header.proposer_address || ""))}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs text-gray-400">{formatTimestampRelative(block.block.header.time)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-900/30 border-2 border-red-700 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <svg className="h-6 w-6 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-200 font-semibold">Error: {error}</span>
                            </div>

                            {/* Retry Button */}
                            <button
                                onClick={() => fetchBlocks()}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                            >
                                {loading ? "⏳" : "🔄 Retry"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                </div>
            </div>
        </div>
    );
}
