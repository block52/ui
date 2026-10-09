import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { NETWORK_PRESETS, NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { useCosmosApiFactory } from "../context/CosmosApiContext";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { Card, CardHeader, PillLink } from "../components/ui";

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

const NodePageHeader = ({ title }: { title: string }) => (
    <div className="flex flex-col gap-2">
        <Link to="/nodes" className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 w-fit text-sm text-ink-muted hover:text-ink">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Network nodes
        </Link>
        <h1 className="m-0 text-[28px] font-semibold text-ink break-words">{title}</h1>
    </div>
);

const detailRowClass = "flex flex-wrap justify-between items-center gap-x-4 gap-y-1 py-3 border-b border-line";

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

    const decodedName = decodeURIComponent(name || "");
    const networkFromState = location.state?.network as NetworkEndpoints | undefined;
    const network =
        NETWORK_PRESETS.find(n => n.name.toLowerCase() === decodedName.toLowerCase()) ||
        discoveredNetworks.find(n => n.name.toLowerCase() === decodedName.toLowerCase()) ||
        networkFromState;

    const fetchNodeStatus = useCallback(
        async (networkConfig: NetworkEndpoints) => {
            setLoading(true);

            try {
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

                if (latestBlockRes.status === "fulfilled") {
                    latestBlock = latestBlockRes.value as LatestBlock;
                    online = true;
                }

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
        },
        [cosmosApiFactory]
    );

    useEffect(() => {
        if (network) {
            document.title = `${network.name} Node Status - Block52`;
            fetchNodeStatus(network);

            const interval = setInterval(() => fetchNodeStatus(network), 15000);
            return () => clearInterval(interval);
        }
    }, [network, fetchNodeStatus]);

    if (!network) {
        return (
            <div className="min-h-screen bg-surface-page text-ink-body">
                <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
                    <NodePageHeader title="Node not found" />
                    <div>
                        <Card className="p-8 text-center">
                            <svg className="h-14 w-14 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <p className="text-ink-muted mb-5">
                                No node found with name: <span className="text-red-400 break-all">{decodedName}</span>
                            </p>
                            <PillLink to="/nodes" variant="primary" size="md">
                                View all nodes
                            </PillLink>
                        </Card>
                    </div>
                </main>
            </div>
        );
    }

    // Get block header info (handles both old and new Cosmos SDK response formats)
    const blockHeader = status.latestBlock?.block?.header || status.latestBlock?.sdk_block?.header;
    const blockHeight = blockHeader?.height || "N/A";
    const blockTime = blockHeader?.time;
    const chainId = blockHeader?.chain_id || status.nodeInfo?.default_node_info?.network || "N/A";

    return (
        <div className="min-h-screen bg-surface-page text-ink-body">
            <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
                <NodePageHeader title={network.name} />

                <div className="flex flex-col gap-6">
                    <Card>
                        <div className={`px-5 py-4 sm:px-6 ${status.online ? "bg-emerald-400/10" : "bg-red-400/10"} border-b border-line`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`w-3 h-3 rounded-full ring-4 ${status.online ? "bg-emerald-400 ring-emerald-400/15" : "bg-red-400 ring-red-400/15"}`}
                                        aria-hidden="true"
                                    />
                                    <span className={`text-xl font-semibold ${status.online ? "text-emerald-400" : "text-red-400"}`}>
                                        {loading ? "Checking..." : status.online ? "Online" : "Offline"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {loading && <LoadingSpinner size="sm" />}
                                    <button
                                        onClick={() => fetchNodeStatus(network)}
                                        disabled={loading}
                                        className="inline-flex items-center justify-center w-11 h-11 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-btn transition-colors disabled:opacity-50"
                                        title="Refresh"
                                        aria-label="Refresh"
                                    >
                                        <svg className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {status.syncStatus?.syncing && (
                                <div className="mt-2 text-amber-400 text-sm flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Syncing with network...
                                </div>
                            )}
                        </div>

                        <div className="px-5 sm:px-6 py-2">
                            <div className={detailRowClass}>
                                <span className="text-ink-muted">Block Height</span>
                                <span className="text-ink font-mono text-lg">{status.online ? `#${parseInt(blockHeight).toLocaleString()}` : "N/A"}</span>
                            </div>

                            <div className={detailRowClass}>
                                <span className="text-ink-muted">Chain ID</span>
                                <span className="text-ink font-mono">{chainId}</span>
                            </div>

                            {blockTime && (
                                <div className={detailRowClass}>
                                    <span className="text-ink-muted">Last Block</span>
                                    <span className="text-ink text-sm">{formatBlockTime(blockTime)}</span>
                                </div>
                            )}

                            {blockTime && (
                                <div className={detailRowClass}>
                                    <span className="text-ink-muted">Time Since Block</span>
                                    <span className="text-ink">{formatUptime(blockTime)}</span>
                                </div>
                            )}

                            {status.nodeInfo?.application_version?.version && (
                                <div className={detailRowClass}>
                                    <span className="text-ink-muted">Node Version</span>
                                    <span className="text-ink font-mono text-sm">{status.nodeInfo.application_version.version}</span>
                                </div>
                            )}

                            {status.nodeInfo?.application_version?.cosmos_sdk_version && (
                                <div className={detailRowClass}>
                                    <span className="text-ink-muted">Cosmos SDK</span>
                                    <span className="text-ink font-mono text-sm">{status.nodeInfo.application_version.cosmos_sdk_version}</span>
                                </div>
                            )}

                            {status.nodeInfo?.default_node_info?.moniker && (
                                <div className={detailRowClass}>
                                    <span className="text-ink-muted">Moniker</span>
                                    <span className="text-ink">{status.nodeInfo.default_node_info.moniker}</span>
                                </div>
                            )}

                            <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 py-3">
                                <span className="text-ink-muted">Last Checked</span>
                                <span className="text-ink-muted text-sm">{status.lastChecked.toLocaleTimeString()}</span>
                            </div>
                        </div>

                        {status.error && !status.online && (
                            <div className="px-5 sm:px-6 py-4 bg-red-400/10 border-t border-red-400/30">
                                <p className="text-red-400 text-sm">{status.error}</p>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <CardHeader title="Endpoints" />
                        <div className="px-5 sm:px-6 py-4 space-y-4">
                            <div>
                                <span className="text-ink-muted text-sm block mb-1">REST API</span>
                                <code className="text-ink-soft text-[13px] font-mono break-all">{network.rest}</code>
                            </div>
                            <div>
                                <span className="text-ink-muted text-sm block mb-1">RPC</span>
                                <code className="text-ink-soft text-[13px] font-mono break-all">{network.rpc}</code>
                            </div>
                            <div>
                                <span className="text-ink-muted text-sm block mb-1">WebSocket</span>
                                <code className="text-ink-soft text-[13px] font-mono break-all">{network.ws}</code>
                            </div>
                            <div>
                                <span className="text-ink-muted text-sm block mb-1">gRPC</span>
                                <code className="text-ink-soft text-[13px] font-mono break-all">{network.grpc}</code>
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
