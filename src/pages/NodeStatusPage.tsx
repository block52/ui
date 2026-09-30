import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { NETWORK_PRESETS, NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { useCosmosApiFactory } from "../context/CosmosApiContext";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";

interface NodeInfo {
    default_node_info?: {
        network: string;
        version: string;
        moniker: string;
        other?: {
            tx_index?: string;
            rpc_address?: string;
        };
    };
    application_version?: {
        name: string;
        app_name: string;
        version: string;
        git_commit: string;
        cosmos_sdk_version: string;
    };
}

interface LatestBlock {
    block?: {
        header?: {
            height: string;
            time: string;
            chain_id: string;
        };
    };
    sdk_block?: {
        header?: {
            height: string;
            time: string;
            chain_id: string;
        };
    };
}

interface SyncStatus {
    syncing: boolean;
}

interface NodeStatus {
    online: boolean;
    nodeInfo: NodeInfo | null;
    latestBlock: LatestBlock | null;
    syncStatus: SyncStatus | null;
    error: string | null;
    lastChecked: Date;
}

function formatUptime(genesisTime: string): string {
    const genesis = new Date(genesisTime);
    const now = new Date();
    const diff = now.getTime() - genesis.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatBlockTime(time: string): string {
    const date = new Date(time);
    return date.toLocaleString();
}

export default function NodeStatusPage() {
    const { name } = useParams<{ name: string }>();
    const location = useLocation();
    const { discoveredNetworks } = useNetwork();
    const cosmosApiFactory = useCosmosApiFactory();
    const [status, setStatus] = useState<NodeStatus>({
        online: false,
        nodeInfo: null,
        latestBlock: null,
        syncStatus: null,
        error: null,
        lastChecked: new Date()
    });
    const [loading, setLoading] = useState(true);

    // Find the network by name (case-insensitive, URL-decoded)
    // Check presets first, then discovered networks, then URL state
    const decodedName = decodeURIComponent(name || "");
    const networkFromState = location.state?.network as NetworkEndpoints | undefined;
    const network = NETWORK_PRESETS.find(
        n => n.name.toLowerCase() === decodedName.toLowerCase()
    ) || discoveredNetworks.find(
        n => n.name.toLowerCase() === decodedName.toLowerCase()
    ) || networkFromState;

    const fetchNodeStatus = useCallback(async (networkConfig: NetworkEndpoints) => {
        setLoading(true);

        try {
            // Fetch node info, latest block, and sync status in parallel
            const api = cosmosApiFactory(networkConfig.rest);
            const [nodeInfoRes, latestBlockRes, syncRes] = await Promise.allSettled([
                api.getNodeInfo(AbortSignal.timeout(10000)),
                api.getLatestBlock(AbortSignal.timeout(10000)),
                api.getSyncing(AbortSignal.timeout(10000))
            ]);

            let nodeInfo: NodeInfo | null = null;
            let latestBlock: LatestBlock | null = null;
            let syncStatus: SyncStatus | null = null;
            let online = false;

            // Parse node info (HTTPClient rejects on non-2xx, so fulfilled === reachable)
            if (nodeInfoRes.status === "fulfilled") {
                nodeInfo = nodeInfoRes.value as NodeInfo;
                online = true;
            }

            // Parse latest block
            if (latestBlockRes.status === "fulfilled") {
                latestBlock = latestBlockRes.value as LatestBlock;
                online = true;
            }

            // Parse sync status
            if (syncRes.status === "fulfilled") {
                syncStatus = syncRes.value as SyncStatus;
            }

            setStatus({
                online,
                nodeInfo,
                latestBlock,
                syncStatus,
                error: online ? null : "Node is not responding",
                lastChecked: new Date()
            });
        } catch (err) {
            setStatus({
                online: false,
                nodeInfo: null,
                latestBlock: null,
                syncStatus: null,
                error: err instanceof Error ? err.message : "Failed to connect to node",
                lastChecked: new Date()
            });
        } finally {
            setLoading(false);
        }
    }, [cosmosApiFactory]);

    useEffect(() => {
        if (network) {
            document.title = `${network.name} Node Status - Block52`;
            fetchNodeStatus(network);

            // Auto-refresh every 15 seconds
            const interval = setInterval(() => fetchNodeStatus(network), 15000);
            return () => clearInterval(interval);
        }
    }, [network, fetchNodeStatus]);

    // Network not found
    if (!network) {
        return (
            <div className="min-h-screen p-8 relative">
                <AnimatedBackground />
                <div className="max-w-7xl mx-auto relative z-10">
                    <ExplorerHeader title="Node Not Found" />
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                            <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-gray-400 mb-4">
                                No node found with name: <span className="text-red-400">{decodedName}</span>
                            </p>
                            <Link
                                to="/nodes"
                                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                            >
                                View All Nodes
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Get block header info (handles both old and new Cosmos SDK response formats)
    const blockHeader = status.latestBlock?.block?.header || status.latestBlock?.sdk_block?.header;
    const blockHeight = blockHeader?.height || "N/A";
    const blockTime = blockHeader?.time;
    const chainId = blockHeader?.chain_id || status.nodeInfo?.default_node_info?.network || "N/A";

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header with navigation */}
                <ExplorerHeader
                    title={network.name}
                />

                <div className="max-w-3xl mx-auto">
                    {/* Status Card */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mb-6">
                        {/* Status Header */}
                        <div className={`p-6 ${status.online ? "bg-green-900/30" : "bg-red-900/30"} border-b border-gray-700`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${status.online ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                                    <span className={`text-xl font-semibold ${status.online ? "text-green-400" : "text-red-400"}`}>
                                        {loading ? "Checking..." : status.online ? "Online" : "Offline"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {loading && <LoadingSpinner size="sm" />}
                                    <button
                                        onClick={() => fetchNodeStatus(network)}
                                        disabled={loading}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                                        title="Refresh"
                                    >
                                        <svg className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {status.syncStatus?.syncing && (
                                <div className="mt-2 text-yellow-400 text-sm flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Syncing with network...
                                </div>
                            )}
                        </div>

                        {/* Node Details */}
                        <div className="p-6 space-y-4">
                            {/* Block Height */}
                            <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                <span className="text-gray-400">Block Height</span>
                                <span className="text-white font-mono text-lg">
                                    {status.online ? `#${parseInt(blockHeight).toLocaleString()}` : "N/A"}
                                </span>
                            </div>

                            {/* Chain ID */}
                            <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                <span className="text-gray-400">Chain ID</span>
                                <span className="text-white font-mono">{chainId}</span>
                            </div>

                            {/* Last Block Time */}
                            {blockTime && (
                                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                    <span className="text-gray-400">Last Block</span>
                                    <span className="text-white text-sm">{formatBlockTime(blockTime)}</span>
                                </div>
                            )}

                            {/* Running Since / Uptime */}
                            {blockTime && (
                                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                    <span className="text-gray-400">Time Since Block</span>
                                    <span className="text-white">{formatUptime(blockTime)}</span>
                                </div>
                            )}

                            {/* Node Version */}
                            {status.nodeInfo?.application_version?.version && (
                                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                    <span className="text-gray-400">Node Version</span>
                                    <span className="text-white font-mono text-sm">
                                        {status.nodeInfo.application_version.version}
                                    </span>
                                </div>
                            )}

                            {/* Cosmos SDK Version */}
                            {status.nodeInfo?.application_version?.cosmos_sdk_version && (
                                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                    <span className="text-gray-400">Cosmos SDK</span>
                                    <span className="text-white font-mono text-sm">
                                        {status.nodeInfo.application_version.cosmos_sdk_version}
                                    </span>
                                </div>
                            )}

                            {/* Moniker */}
                            {status.nodeInfo?.default_node_info?.moniker && (
                                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                                    <span className="text-gray-400">Moniker</span>
                                    <span className="text-white">{status.nodeInfo.default_node_info.moniker}</span>
                                </div>
                            )}

                            {/* Last Checked */}
                            <div className="flex justify-between items-center py-3">
                                <span className="text-gray-400">Last Checked</span>
                                <span className="text-gray-500 text-sm">
                                    {status.lastChecked.toLocaleTimeString()}
                                </span>
                            </div>
                        </div>

                        {/* Error Message */}
                        {status.error && !status.online && (
                            <div className="p-4 bg-red-900/30 border-t border-red-700">
                                <p className="text-red-400 text-sm">{status.error}</p>
                            </div>
                        )}
                    </div>

                    {/* Endpoints Card */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">Endpoints</h2>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <span className="text-gray-400 text-sm block mb-1">REST API</span>
                                <code className="text-blue-400 text-sm font-mono break-all">{network.rest}</code>
                            </div>
                            <div>
                                <span className="text-gray-400 text-sm block mb-1">RPC</span>
                                <code className="text-blue-400 text-sm font-mono break-all">{network.rpc}</code>
                            </div>
                            <div>
                                <span className="text-gray-400 text-sm block mb-1">WebSocket</span>
                                <code className="text-blue-400 text-sm font-mono break-all">{network.ws}</code>
                            </div>
                            <div>
                                <span className="text-gray-400 text-sm block mb-1">gRPC</span>
                                <code className="text-blue-400 text-sm font-mono break-all">{network.grpc}</code>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Powered by Block52 */}
                <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                    <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                        <div className="text-left mb-1">
                            <span className="text-xs text-white font-medium tracking-wide">POWERED BY</span>
                        </div>
                        <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}
