import { NetworkEndpoints } from "../context/NetworkContext";

/**
 * Represents a peer discovered via the network
 */
export interface DiscoveredPeer {
    id: string;
    moniker: string;
    remoteIp: string;
    listenAddr: string;
}

/**
 * Represents a node with its endpoints
 */
export interface DiscoveredNode {
    id: string;
    moniker: string;
    remoteIp: string;
    listenAddr: string;
    endpoints: NetworkEndpoints | null;
    isPreset: boolean;
    isIpBased: boolean;
    probeStatus?: "pending" | "reachable" | "unreachable";
    blockHeight?: string | null;
    chainId?: string | null;
    isValidator?: boolean;
}

/**
 * Response from /rpc/net_info endpoint
 */
interface NetInfoResponse {
    result?: {
        peers?: Array<{
            node_info: {
                id: string;
                moniker: string;
                listen_addr: string;
            };
            remote_ip: string;
        }>;
    };
}

/**
 * Cache key for localStorage
 */
const DISCOVERED_NODES_CACHE_KEY = "discovered_nodes_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Extract domain from listen_addr (e.g., "node1.block52.xyz:26656" -> "node1.block52.xyz")
 */
function extractDomain(listenAddr: string): string | null {
    // Remove tcp:// prefix if present
    const addr = listenAddr.replace(/^tcp:\/\//, "");

    // Split by : to get host part
    const [host] = addr.split(":");

    // Check if it's a domain (not 0.0.0.0 or IP-like)
    if (host === "0.0.0.0" || host === "localhost") {
        return null;
    }

    // Check if it looks like a domain (contains letters and dots)
    if (/^[a-zA-Z]/.test(host) && host.includes(".")) {
        return host;
    }

    return null;
}

/**
 * Build potential endpoints from a discovered peer
 * Returns endpoints and whether the node is IP-based
 */
function buildEndpointsFromPeer(peer: DiscoveredPeer): { endpoints: NetworkEndpoints | null; isIpBased: boolean } {
    const domain = extractDomain(peer.listenAddr);

    if (domain) {
        // Domain-based node - use HTTPS with standard paths
        return {
            endpoints: {
                name: peer.moniker,
                rest: `https://${domain}`,
                rpc: `https://${domain}/rpc/`,
                grpc: `grpcs://${domain}:9443`,
                ws: `wss://${domain}/ws`
            },
            isIpBased: false
        };
    }

    // IP-based node - try HTTP on standard ports
    const ip = peer.remoteIp;
    if (ip && ip !== "0.0.0.0" && ip !== "127.0.0.1") {
        return {
            endpoints: {
                name: peer.moniker || `Node ${ip}`,
                rest: `http://${ip}:1317`,
                rpc: `http://${ip}:26657`,
                grpc: `http://${ip}:9090`,
                ws: `ws://${ip}:8585/ws`
            },
            isIpBased: true
        };
    }

    return { endpoints: null, isIpBased: false };
}

/**
 * Discover peers from a seed node using the /rpc/net_info endpoint
 */
export async function discoverPeers(seedNode: NetworkEndpoints): Promise<DiscoveredPeer[]> {
    try {
        const response = await fetch(
            `${seedNode.rpc}net_info`,
            { signal: AbortSignal.timeout(10000) }
        );

        if (!response.ok) {
            return [];
        }

        const data: NetInfoResponse = await response.json();
        const peers = data.result?.peers || [];

        return peers.map(peer => ({
            id: peer.node_info.id,
            moniker: peer.node_info.moniker,
            listenAddr: peer.node_info.listen_addr,
            remoteIp: peer.remote_ip
        }));
    } catch {
        return [];
    }
}

/**
 * Discover and validate nodes from multiple seed nodes
 */
export async function discoverNodes(
    seedNodes: NetworkEndpoints[],
    existingPresets: NetworkEndpoints[]
): Promise<DiscoveredNode[]> {
    const allPeers: DiscoveredPeer[] = [];
    const seenIds = new Set<string>();

    // Discover peers from all seed nodes
    for (const seed of seedNodes) {
        const peers = await discoverPeers(seed);
        for (const peer of peers) {
            if (!seenIds.has(peer.id)) {
                seenIds.add(peer.id);
                allPeers.push(peer);
            }
        }
    }

    // Convert peers to nodes
    const nodes: DiscoveredNode[] = allPeers.map(peer => {
        const { endpoints, isIpBased } = buildEndpointsFromPeer(peer);

        // Check if this matches an existing preset (by comparing domains/IPs)
        const isPreset = existingPresets.some(preset => {
            const presetDomain = new URL(preset.rest).hostname;
            const peerDomain = extractDomain(peer.listenAddr);
            return presetDomain === peerDomain || presetDomain === peer.remoteIp;
        });

        return {
            id: peer.id,
            moniker: peer.moniker,
            remoteIp: peer.remoteIp,
            listenAddr: peer.listenAddr,
            endpoints,
            isPreset,
            isIpBased,
            probeStatus: "pending" as const
        };
    });

    return nodes;
}

/**
 * Probe a node's endpoints to check if it's reachable
 * Returns reachability status and node info if successful
 */
export async function probeNodeEndpoints(endpoints: NetworkEndpoints): Promise<{
    reachable: boolean;
    blockHeight: string | null;
    chainId: string | null;
    isValidator: boolean;
}> {
    let isValidator = false;
    const rpcUrl = endpoints.rpc.endsWith("/") ? endpoints.rpc : `${endpoints.rpc}/`;

    try {
        const response = await fetch(`${rpcUrl}status`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
            const data = await response.json();
            const votingPower = Number(data.result?.validator_info?.voting_power ?? 0);
            isValidator = Number.isFinite(votingPower) && votingPower > 0;
        }
    } catch {
        // Role detection is best effort; reachability is checked below.
    }

    // Try REST API first (most reliable for Cosmos nodes)
    try {
        const response = await fetch(
            `${endpoints.rest}/cosmos/base/tendermint/v1beta1/blocks/latest`,
            { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
            const data = await response.json();
            const header = data.block?.header || data.sdk_block?.header;
            return {
                reachable: true,
                blockHeight: header?.height || null,
                chainId: header?.chain_id || null,
                isValidator
            };
        }
    } catch {
        // REST failed, try RPC /status endpoint
    }

    // Try RPC /status endpoint as fallback
    try {
        const rpcResponse = await fetch(
            `${rpcUrl}status`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (rpcResponse.ok) {
            const data = await rpcResponse.json();
            return {
                reachable: true,
                blockHeight: data.result?.sync_info?.latest_block_height || null,
                chainId: data.result?.node_info?.network || null,
                isValidator
            };
        }
    } catch {
        // Both failed
    }

    return { reachable: false, blockHeight: null, chainId: null, isValidator: false };
}

/**
 * Probe multiple nodes in parallel and update their status
 */
export async function probeNodes(nodes: DiscoveredNode[]): Promise<DiscoveredNode[]> {
    const results = await Promise.all(
        nodes.map(async (node) => {
            if (!node.endpoints) {
                return { ...node, probeStatus: "unreachable" as const };
            }

            const probeResult = await probeNodeEndpoints(node.endpoints);
            return {
                ...node,
                probeStatus: probeResult.reachable ? "reachable" as const : "unreachable" as const,
                blockHeight: probeResult.blockHeight,
                chainId: probeResult.chainId,
                isValidator: probeResult.isValidator
            };
        })
    );

    return results;
}

/**
 * Get cached discovered nodes from localStorage
 */
export function getCachedNodes(): DiscoveredNode[] | null {
    try {
        const cached = localStorage.getItem(DISCOVERED_NODES_CACHE_KEY);
        if (!cached) return null;

        const { nodes, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        if (age > CACHE_TTL_MS) {
            localStorage.removeItem(DISCOVERED_NODES_CACHE_KEY);
            return null;
        }

        return nodes;
    } catch {
        return null;
    }
}

/**
 * Cache discovered nodes to localStorage
 */
export function cacheNodes(nodes: DiscoveredNode[]): void {
    try {
        localStorage.setItem(
            DISCOVERED_NODES_CACHE_KEY,
            JSON.stringify({
                nodes,
                timestamp: Date.now()
            })
        );
    } catch {
        // Failed to cache discovered nodes - localStorage may be full or unavailable
    }
}

/**
 * Clear the node discovery cache
 */
export function clearNodeCache(): void {
    localStorage.removeItem(DISCOVERED_NODES_CACHE_KEY);
}
