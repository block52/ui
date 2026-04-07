import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { NETWORK_PRESETS, NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { DiscoveredNode, discoverNodes, probeNodes, getCachedNodes, cacheNodes, clearNodeCache } from "../services/nodeDiscovery";

// Filter out localhost for production view
const productionNodes = NETWORK_PRESETS.filter(n => n.name !== "Localhost");

interface NodeInfo {
    status: "checking" | "online" | "offline";
    blockHeight: string | null;
}

interface ValidatorInfo {
    moniker: string;
    operatorAddress: string;
    status: string;
}

export default function NodesPage() {
    const { addDiscoveredNetwork, discoveredNetworks } = useNetwork();
    const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveredNode[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isProbing, setIsProbing] = useState(false);
    const [nodeInfo, setNodeInfo] = useState<Record<string, NodeInfo>>({});
    const [validators, setValidators] = useState<ValidatorInfo[]>([]);
    // Fetch validators from the network
    const fetchValidators = useCallback(async () => {
        // Try fetching from the first online preset node
        for (const node of productionNodes) {
            try {
                const response = await fetch(`${node.rest}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`, {
                    signal: AbortSignal.timeout(10000)
                });
                if (response.ok) {
                    const data = await response.json();
                    const validatorList: ValidatorInfo[] = (data.validators || []).map((v: any) => ({
                        moniker: v.description?.moniker || "",
                        operatorAddress: v.operator_address || "",
                        status: v.status || ""
                    }));
                    setValidators(validatorList);
                    return;
                }
            } catch {
                // Try next node
            }
        }
    }, []);

    // Check if a moniker matches a validator
    // Handles variations like "Texas Hodl" matching "validator-texashodl"
    const isValidator = useCallback(
        (moniker: string): boolean => {
            if (!moniker || validators.length === 0) return false;
            // Normalize: lowercase, remove spaces/dashes/underscores
            const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
            const normalizedMoniker = normalize(moniker);
            return validators.some(v => {
                const normalizedValidator = normalize(v.moniker);
                // Check if either contains the other, or if they share significant overlap
                return (
                    normalizedValidator.includes(normalizedMoniker) ||
                    normalizedMoniker.includes(normalizedValidator) ||
                    // Also check for partial matches like "texashodl" in "validator-texashodl"
                    normalizedValidator.replace("validator", "").includes(normalizedMoniker.replace("validator", "")) ||
                    normalizedMoniker.replace("validator", "").includes(normalizedValidator.replace("validator", ""))
                );
            });
        },
        [validators]
    );

    // Check node status and get block height
    const checkNode = useCallback(async (network: NetworkEndpoints): Promise<NodeInfo> => {
        try {
            const response = await fetch(`${network.rest}/cosmos/base/tendermint/v1beta1/blocks/latest`, { signal: AbortSignal.timeout(5000) });
            if (!response.ok) {
                return { status: "offline", blockHeight: null };
            }
            const data = await response.json();
            const header = data.block?.header || data.sdk_block?.header;
            return {
                status: "online",
                blockHeight: header?.height || null
            };
        } catch {
            return { status: "offline", blockHeight: null };
        }
    }, []);

    // Check all nodes on page load
    const checkAllNodes = useCallback(async () => {
        // Set all to checking
        const initialInfo: Record<string, NodeInfo> = {};
        productionNodes.forEach(n => {
            initialInfo[n.name] = { status: "checking", blockHeight: null };
        });
        setNodeInfo(initialInfo);

        // Check each node in parallel
        const results = await Promise.all(
            productionNodes.map(async network => {
                const info = await checkNode(network);
                return { name: network.name, info };
            })
        );

        // Update info
        const newInfo: Record<string, NodeInfo> = {};
        results.forEach(r => {
            newInfo[r.name] = r.info;
        });
        setNodeInfo(newInfo);
    }, [checkNode]);

    // Discover new nodes from the network
    const handleDiscoverNodes = useCallback(async () => {
        setIsDiscovering(true);
        clearNodeCache();

        try {
            const discovered = await discoverNodes(productionNodes, productionNodes);

            // Filter out nodes that match presets
            const newDiscovered = discovered.filter(d => !d.isPreset);

            setDiscoveredNodes(newDiscovered);
            cacheNodes(newDiscovered);

            // Now probe the discovered nodes to check reachability
            if (newDiscovered.length > 0) {
                setIsProbing(true);
                const probed = await probeNodes(newDiscovered);
                setDiscoveredNodes(probed);
                cacheNodes(probed);
                setIsProbing(false);
            }
        } catch (error) {
            console.error("Failed to discover nodes:", error);
        } finally {
            setIsDiscovering(false);
            setIsProbing(false);
        }
    }, []);

    // Handle adding a discovered node to the network selector
    const handleAddToNetworks = useCallback(
        (node: DiscoveredNode) => {
            if (node.endpoints) {
                addDiscoveredNetwork(node.endpoints);
            }
        },
        [addDiscoveredNetwork]
    );

    // Check if a node is already added to networks
    const isNodeAdded = useCallback(
        (node: DiscoveredNode) => {
            if (!node.endpoints) return false;
            return discoveredNetworks.some(n => n.name === node.endpoints!.name || n.rest === node.endpoints!.rest);
        },
        [discoveredNetworks]
    );

    // Load cached discovered nodes on mount
    useEffect(() => {
        const cached = getCachedNodes();
        if (cached) {
            setDiscoveredNodes(cached.filter(n => !n.isPreset));
        }
    }, []);

    useEffect(() => {
        document.title = "Nodes - Block52";
        checkAllNodes();
        fetchValidators();
    }, [checkAllNodes, fetchValidators]);

    // Calculate stats
    const presetOnlineCount = Object.values(nodeInfo).filter(n => n.status === "online").length;
    const discoveredReachableCount = discoveredNodes.filter(n => n.probeStatus === "reachable").length;
    const totalOnline = presetOnlineCount + discoveredReachableCount;
    const totalNodes = productionNodes.length + discoveredNodes.length;

    // Count validators and sync nodes (sync = non-validator nodes)
    const presetValidatorCount = productionNodes.filter(n => isValidator(n.name)).length;
    const discoveredValidatorCount = discoveredNodes.filter(n => isValidator(n.moniker)).length;
    const totalValidators = validators.length; // Use actual validator count from API
    const totalSyncNodes = totalNodes - (presetValidatorCount + discoveredValidatorCount);

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <ExplorerHeader title="Network Nodes" />

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="text-3xl font-bold text-green-400">{totalOnline}</div>
                        <div className="text-sm text-gray-400">Healthy Nodes</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="text-3xl font-bold text-gray-400">{totalNodes}</div>
                        <div className="text-sm text-gray-400">Total Nodes</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="text-3xl font-bold text-purple-400">{validators.length}</div>
                        <div className="text-sm text-gray-400">Validators</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="text-3xl font-bold text-blue-400">{totalSyncNodes}</div>
                        <div className="text-sm text-gray-400">Sync Nodes</div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="mb-6 flex justify-end gap-2">
                    <button
                        onClick={handleDiscoverNodes}
                        disabled={isDiscovering || isProbing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                        {isDiscovering ? (
                            <>
                                <LoadingSpinner size="sm" />
                                Discovering...
                            </>
                        ) : isProbing ? (
                            <>
                                <LoadingSpinner size="sm" />
                                Probing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Discover Nodes
                            </>
                        )}
                    </button>
                </div>

                {/* Preset Nodes Table */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Preset Nodes</h2>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Block Height</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Endpoint</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {productionNodes.map(network => {
                                        const info = nodeInfo[network.name];
                                        const status = info?.status || "checking";
                                        const blockHeight = info?.blockHeight;
                                        const nodeIsValidator = isValidator(network.name);

                                        return (
                                            <tr key={network.name} className="hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-white font-semibold">{network.name}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                            nodeIsValidator ? "bg-purple-900/50 text-purple-400" : "bg-blue-900/50 text-blue-400"
                                                        }`}
                                                    >
                                                        {nodeIsValidator ? "Validator" : "Sync"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            status === "checking"
                                                                ? "bg-yellow-900/50 text-yellow-400"
                                                                : status === "online"
                                                                  ? "bg-green-900/50 text-green-400"
                                                                  : "bg-red-900/50 text-red-400"
                                                        }`}
                                                    >
                                                        {status === "checking" ? "Checking..." : status === "online" ? "Online" : "Offline"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {status === "checking" ? (
                                                        <span className="text-gray-500">-</span>
                                                    ) : blockHeight ? (
                                                        <span className="text-blue-400 font-mono">#{parseInt(blockHeight).toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-xs text-gray-400">{network.rest}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <Link
                                                        to={`/node/${encodeURIComponent(network.name)}`}
                                                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors inline-flex items-center gap-1"
                                                    >
                                                        View Details
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Discovered Nodes Section */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Discovered Nodes
                        {discoveredNodes.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({discoveredNodes.length} found)</span>}
                    </h2>

                    {discoveredNodes.length === 0 ? (
                        <div className="text-center py-8 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-gray-400 mb-2">No additional nodes discovered yet</p>
                            <p className="text-gray-500 text-sm">Click "Discover Nodes" to search for peers on the network</p>
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-900">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Name</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Role</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Source</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Block Height</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">IP / Endpoint</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {discoveredNodes.map(node => {
                                            const added = isNodeAdded(node);
                                            const nodeIsValidator = isValidator(node.moniker);
                                            return (
                                                <tr key={node.id} className="hover:bg-gray-700/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-white font-semibold">{node.moniker}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                                nodeIsValidator ? "bg-purple-900/50 text-purple-400" : "bg-blue-900/50 text-blue-400"
                                                            }`}
                                                        >
                                                            {nodeIsValidator ? "Validator" : "Sync"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                                node.isIpBased ? "bg-orange-900/50 text-orange-400" : "bg-cyan-900/50 text-cyan-400"
                                                            }`}
                                                        >
                                                            {node.isIpBased ? "IP" : "Domain"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                node.probeStatus === "pending"
                                                                    ? "bg-yellow-900/50 text-yellow-400"
                                                                    : node.probeStatus === "reachable"
                                                                      ? "bg-green-900/50 text-green-400"
                                                                      : "bg-red-900/50 text-red-400"
                                                            }`}
                                                        >
                                                            {node.probeStatus === "pending"
                                                                ? "Probing..."
                                                                : node.probeStatus === "reachable"
                                                                  ? "Reachable"
                                                                  : "Unreachable"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {node.blockHeight ? (
                                                            <span className="text-blue-400 font-mono">#{parseInt(node.blockHeight).toLocaleString()}</span>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs text-gray-400">{node.remoteIp}</span>
                                                            {node.endpoints && <span className="font-mono text-xs text-gray-500">{node.endpoints.rest}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {node.probeStatus === "reachable" && node.endpoints && (
                                                                <>
                                                                    {added ? (
                                                                        <span className="text-green-400 text-sm">Added</span>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleAddToNetworks(node)}
                                                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                                                                        >
                                                                            Add to Networks
                                                                        </button>
                                                                    )}
                                                                    <Link
                                                                        to={`/node/${encodeURIComponent(node.moniker)}`}
                                                                        state={{ network: node.endpoints }}
                                                                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors inline-flex items-center gap-1"
                                                                    >
                                                                        View Details
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M9 5l7 7-7 7"
                                                                            />
                                                                        </svg>
                                                                    </Link>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
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
