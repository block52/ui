import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { NETWORK_PRESETS, NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { useCosmosApiFactory } from "../context/CosmosApiContext";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { DiscoveredNode, discoverNodes, probeNodes, getCachedNodes, cacheNodes, clearNodeCache } from "../services/nodeDiscovery";
import { isEmpty, hasElements, hasValue } from "../utils/guards";
import { formatAgo, secondsBetween, sumBigInt } from "../utils/nodePortal";
import { formatMicroAsUsdc } from "../constants/currency";
import ValidatorEarningsPanel from "../components/explorer/ValidatorEarningsPanel";
import { useValidatorBonds } from "../hooks/game/useValidatorBonds";
import { useChainOverview } from "../hooks/nodes/useChainOverview";
import { NetworkInfoPanel } from "../components/nodes/NetworkInfoPanel";
import { RunNodePanel } from "../components/nodes/RunNodePanel";
import { BecomeValidatorPanel } from "../components/nodes/BecomeValidatorPanel";
import { Card, CardHeader, PageTabs, PillButton, PillLink, StatStrip, pillClass } from "../components/ui";
import type { StatItem } from "../components/ui";

type NodesTab = "nodes" | "network" | "run" | "validator";

const TABS: ReadonlyArray<{ key: NodesTab; label: string }> = [
    { key: "nodes", label: "Nodes" },
    { key: "network", label: "Network & genesis" },
    { key: "run", label: "Run a node" },
    { key: "validator", label: "Become a validator" }
];

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

type DotTone = "good" | "bad" | "pending";

const dotClass: Record<DotTone, string> = {
    good: "bg-emerald-400 ring-emerald-400/15",
    bad: "bg-red-400 ring-red-400/15",
    pending: "bg-ink-muted ring-ink-muted/15 animate-pulse"
};

const statusTextClass: Record<DotTone, string> = {
    good: "text-emerald-400",
    bad: "text-red-400",
    pending: "text-ink-muted"
};

/** Node name with a status dot (soft ring) and the status word under it. */
const NodeNameCell = ({ name, tone, statusLabel, mobileRole }: { name: string; tone: DotTone; statusLabel: string; mobileRole?: React.ReactNode }) => (
    <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 shrink-0 rounded-full ring-4 ${dotClass[tone]}`} aria-hidden="true" />
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-ink text-[15px] font-medium">{name}</span>
            <span className={`text-xs ${statusTextClass[tone]}`}>{statusLabel}</span>
            {/* The Role column is hidden on phones; show the pill here instead. */}
            {mobileRole && <span className="sm:hidden mt-1">{mobileRole}</span>}
        </div>
    </div>
);

/** `isValidator` is null until the validator set has loaded: show a muted placeholder, not a guessed role. */
const RolePill = ({ isValidator }: { isValidator: boolean | null }) =>
    isValidator === null ? (
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-line text-ink-muted" aria-label="Role loading">
            …
        </span>
    ) : (
        <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isValidator ? "bg-brand/20 text-brand-light" : "bg-blue-500/15 text-blue-300"
            }`}
        >
            {isValidator ? "Validator" : "Sync"}
        </span>
    );

const formatHeight = (height: string): string => `#${parseInt(height).toLocaleString()}`;

const thClass = "px-4 py-3.5 first:pl-5 last:pr-5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted";
const tdClass = "px-4 py-3.5 first:pl-5 last:pr-5 whitespace-nowrap";
const rowClass = "border-t border-line hover:bg-surface-raised transition-colors";
// PillLink/PillButton "sm" is 36px; grow to a 44px tap target on phones.
const detailsPillExtra = "max-sm:h-11";

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

export default function NodesPage() {
    const [tab, setTab] = useState<NodesTab>("nodes");
    const { overview, isLoading: isOverviewLoading, error: overviewError, refresh: refreshOverview } = useChainOverview();
    const { addDiscoveredNetwork, discoveredNetworks } = useNetwork();
    const cosmosApiFactory = useCosmosApiFactory();
    const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveredNode[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isProbing, setIsProbing] = useState(false);
    const [nodeInfo, setNodeInfo] = useState<Record<string, NodeInfo>>({});
    const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [validators, setValidators] = useState<ValidatorInfo[]>([]);
    // False until a node has answered the validator query; roles and counts are unknown before that.
    const [validatorsLoaded, setValidatorsLoaded] = useState(false);
    // Validator bonded-USDC weights + protocol-fee earnings (poker-vm#2592).
    // Bonded USDC per validator comes from the standard Cosmos staking `tokens`
    // field (bond denom is USDC), so no custom poker-module query is needed. See
    // useValidatorBonds. Accrued fee earnings over time remain a separate concern.
    const { bonds: validatorBonds, hasQuery: hasValidatorBondQuery, isLoading: isValidatorBondsLoading } = useValidatorBonds();
    // Fetch validators from the network
    const fetchValidators = useCallback(async () => {
        // Try fetching from the first online preset node
        for (const node of productionNodes) {
            try {
                const data = (await cosmosApiFactory(node.rest).getValidatorsByStatus("BOND_STATUS_BONDED", AbortSignal.timeout(10000))) as {
                    validators?: any[];
                };
                const validatorList: ValidatorInfo[] = (data.validators || []).map((v: any) => ({
                    moniker: v.description?.moniker || "",
                    operatorAddress: v.operator_address || "",
                    status: v.status || ""
                }));
                setValidators(validatorList);
                setValidatorsLoaded(true);
                return;
            } catch {
                // Try next node
            }
        }
    }, [cosmosApiFactory]);

    // Check if a moniker matches a validator
    // Handles variations like "Texas Hodl" matching "validator-texashodl"
    const isValidator = useCallback(
        (moniker: string): boolean => {
            if (!moniker || isEmpty(validators)) return false;
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
    const checkNode = useCallback(
        async (network: NetworkEndpoints): Promise<NodeInfo> => {
            try {
                const data = (await cosmosApiFactory(network.rest).getLatestBlock(AbortSignal.timeout(5000))) as {
                    block?: { header?: { height?: string } };
                    sdk_block?: { header?: { height?: string } };
                };
                const header = data.block?.header || data.sdk_block?.header;
                return {
                    status: "online",
                    blockHeight: header?.height || null
                };
            } catch {
                return { status: "offline", blockHeight: null };
            }
        },
        [cosmosApiFactory]
    );

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
        setLastCheckedAt(Date.now());
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
            if (hasElements(newDiscovered)) {
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

    const handleSelectTab = useCallback((key: string) => {
        const next = TABS.find(t => t.key === key);
        if (next) setTab(next.key);
    }, []);

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

    // Tick the "Checked … ago" label once the first check has finished.
    useEffect(() => {
        if (lastCheckedAt === null) return;
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [lastCheckedAt]);

    // Calculate stats
    const presetOnlineCount = Object.values(nodeInfo).filter(n => n.status === "online").length;
    const discoveredReachableCount = discoveredNodes.filter(n => n.probeStatus === "reachable").length;
    const totalOnline = presetOnlineCount + discoveredReachableCount;
    const totalNodes = productionNodes.length + discoveredNodes.length;

    // Count validators and sync nodes (sync = non-validator nodes)
    const presetValidatorCount = productionNodes.filter(n => isValidator(n.name)).length;
    const discoveredValidatorCount = discoveredNodes.filter(n => isValidator(n.moniker)).length;
    const totalSyncNodes = totalNodes - (presetValidatorCount + discoveredValidatorCount);

    // Total bonded USDC from the bonds already loaded for the earnings panel; when
    // those are unavailable, fall back to the highest block height seen instead.
    const totalBonded = useMemo(
        () => (hasValidatorBondQuery && hasElements(validatorBonds) ? sumBigInt(validatorBonds.map(b => BigInt(b.bondedUsdc.toString()))) : null),
        [hasValidatorBondQuery, validatorBonds]
    );
    const highestHeight = useMemo(() => {
        const heights = Object.values(nodeInfo)
            .map(n => n.blockHeight)
            .filter((h): h is string => hasValue(h))
            .map(h => parseInt(h));
        return hasElements(heights) ? Math.max(...heights) : null;
    }, [nodeInfo]);

    const stats: StatItem[] = [
        { label: "Healthy", value: totalOnline, suffix: `of ${totalNodes} nodes`, tone: "good" },
        validatorsLoaded ? { label: "Validators", value: validators.length } : { label: "Validators", value: "—", tone: "muted" },
        validatorsLoaded ? { label: "Sync nodes", value: totalSyncNodes } : { label: "Sync nodes", value: "—", tone: "muted" },
        totalBonded !== null
            ? { label: "Total bonded", value: `$${formatMicroAsUsdc(totalBonded, 2)}` }
            : highestHeight !== null
              ? { label: "Block height", value: `#${highestHeight.toLocaleString()}` }
              : { label: "Block height", value: "-", tone: "muted" }
    ];

    const scanBusy = isDiscovering || isProbing;
    const scanButton = (
        <PillButton variant="outline" size="md" onClick={handleDiscoverNodes} disabled={scanBusy}>
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
                    <SearchIcon />
                    Scan for peers
                </>
            )}
        </PillButton>
    );

    const hasDiscovered = hasElements(discoveredNodes);

    return (
        <div className="min-h-screen bg-surface-page text-ink-body">
            <main className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="m-0 text-[28px] font-semibold text-ink">Network Nodes</h1>
                        <span className="text-ink-muted">Who is running Pokerchain, and how to join them</span>
                    </div>
                    <PillButton variant="primary" size="md" className="text-[15px]" onClick={() => setTab("validator")}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Become a validator
                    </PillButton>
                </div>

                <PageTabs tabs={TABS} activeKey={tab} ariaLabel="Node sections" onSelect={handleSelectTab} />

                {tab !== "nodes" && (
                    <div>
                        {isOverviewLoading && !overview && <LoadingSpinner />}
                        {overviewError && <p className="text-red-400 text-sm mb-4">Could not load chain info: {overviewError}</p>}
                        {overview && tab === "network" && <NetworkInfoPanel overview={overview} />}
                        {overview && tab === "run" && <RunNodePanel overview={overview} />}
                        {overview && tab === "validator" && <BecomeValidatorPanel overview={overview} onBonded={refreshOverview} />}
                    </div>
                )}

                {tab === "nodes" && (
                    <>
                        <StatStrip items={stats} />

                        {/* Preset nodes */}
                        <Card>
                            <CardHeader
                                title="Preset nodes"
                                actions={
                                    lastCheckedAt !== null && (
                                        <span className="text-ink-muted text-sm">Checked {formatAgo(secondsBetween(lastCheckedAt, now))}</span>
                                    )
                                }
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>Node</th>
                                            <th className={`${thClass} hidden sm:table-cell`}>Role</th>
                                            <th className={thClass}>Block height</th>
                                            <th className={`${thClass} hidden md:table-cell`}>Endpoint</th>
                                            <th className={thClass}>
                                                <span className="sr-only">Details</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productionNodes.map(network => {
                                            const info = nodeInfo[network.name];
                                            const status = info?.status || "checking";
                                            const blockHeight = info?.blockHeight;
                                            const tone: DotTone = status === "online" ? "good" : status === "offline" ? "bad" : "pending";

                                            return (
                                                <tr key={network.name} className={rowClass}>
                                                    <td className={tdClass}>
                                                        <NodeNameCell
                                                            name={network.name}
                                                            tone={tone}
                                                            statusLabel={status === "checking" ? "Checking..." : status === "online" ? "Online" : "Offline"}
                                                            mobileRole={<RolePill isValidator={validatorsLoaded ? isValidator(network.name) : null} />}
                                                        />
                                                    </td>
                                                    <td className={`${tdClass} hidden sm:table-cell`}>
                                                        <RolePill isValidator={validatorsLoaded ? isValidator(network.name) : null} />
                                                    </td>
                                                    <td className={`${tdClass} tabular-nums`}>
                                                        {status === "offline" ? (
                                                            <span className="text-ink-muted">Not reachable</span>
                                                        ) : status === "online" && blockHeight ? (
                                                            <span className="text-ink">{formatHeight(blockHeight)}</span>
                                                        ) : (
                                                            <span className="text-ink-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td className={`${tdClass} hidden md:table-cell font-mono text-[13px] text-ink-muted`}>{network.rest}</td>
                                                    <td className={`${tdClass} text-right`}>
                                                        <PillLink
                                                            to={`/node/${encodeURIComponent(network.name)}`}
                                                            className={detailsPillExtra}
                                                            aria-label={`${network.name} details`}
                                                        >
                                                            Details
                                                        </PillLink>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <div className={`grid grid-cols-1 gap-6 items-start ${hasDiscovered ? "" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}>
                            {/* Validator Earnings (poker-vm#2592) — bonded USDC is the
                                SNG protocol-fee split weight; earnings await a backend query. */}
                            <ValidatorEarningsPanel
                                bonds={validatorBonds}
                                hasQuery={hasValidatorBondQuery}
                                isLoading={isValidatorBondsLoading}
                                className="min-w-0"
                            />

                            {/* Discovered nodes */}
                            {!hasDiscovered ? (
                                <Card className="p-6 flex flex-col items-start gap-2.5">
                                    <h2 className="m-0 text-[17px] font-semibold text-ink">Discovered nodes</h2>
                                    <p className="m-0 text-ink-muted leading-normal">
                                        No peers found beyond the preset list. Scanning asks each preset node for the peers it knows about.
                                    </p>
                                    <div className="mt-1.5">{scanButton}</div>
                                </Card>
                            ) : (
                                <Card className="min-w-0">
                                    <CardHeader title="Discovered nodes" subtitle={`${discoveredNodes.length} found`} actions={scanButton} />
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] border-collapse text-sm">
                                            <thead>
                                                <tr>
                                                    <th className={thClass}>Node</th>
                                                    <th className={thClass}>Role</th>
                                                    <th className={thClass}>Source</th>
                                                    <th className={thClass}>Block height</th>
                                                    <th className={thClass}>IP / Endpoint</th>
                                                    <th className={thClass}>
                                                        <span className="sr-only">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {discoveredNodes.map(node => {
                                                    const added = isNodeAdded(node);
                                                    const tone: DotTone =
                                                        node.probeStatus === "reachable" ? "good" : node.probeStatus === "pending" ? "pending" : "bad";
                                                    return (
                                                        <tr key={node.id} className={rowClass}>
                                                            <td className={tdClass}>
                                                                <NodeNameCell
                                                                    name={node.moniker}
                                                                    tone={tone}
                                                                    statusLabel={
                                                                        node.probeStatus === "pending"
                                                                            ? "Probing..."
                                                                            : node.probeStatus === "reachable"
                                                                              ? "Reachable"
                                                                              : "Unreachable"
                                                                    }
                                                                />
                                                            </td>
                                                            <td className={tdClass}>
                                                                <RolePill isValidator={validatorsLoaded ? isValidator(node.moniker) : null} />
                                                            </td>
                                                            <td className={tdClass}>
                                                                <span
                                                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                                        node.isIpBased ? "bg-orange-500/15 text-orange-300" : "bg-cyan-500/15 text-cyan-300"
                                                                    }`}
                                                                >
                                                                    {node.isIpBased ? "IP" : "Domain"}
                                                                </span>
                                                            </td>
                                                            <td className={`${tdClass} tabular-nums`}>
                                                                {node.blockHeight ? (
                                                                    <span className="text-ink">{formatHeight(node.blockHeight)}</span>
                                                                ) : node.probeStatus === "unreachable" ? (
                                                                    <span className="text-ink-muted">Not reachable</span>
                                                                ) : (
                                                                    <span className="text-ink-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td className={tdClass}>
                                                                <div className="flex flex-col font-mono text-[13px]">
                                                                    <span className="text-ink-soft">{node.remoteIp}</span>
                                                                    {node.endpoints && <span className="text-ink-muted">{node.endpoints.rest}</span>}
                                                                </div>
                                                            </td>
                                                            <td className={`${tdClass} text-right`}>
                                                                {node.probeStatus === "reachable" && node.endpoints && (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {added ? (
                                                                            <span className="text-emerald-400 text-sm">Added</span>
                                                                        ) : (
                                                                            <PillButton
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className={detailsPillExtra}
                                                                                onClick={() => handleAddToNetworks(node)}
                                                                            >
                                                                                Add to networks
                                                                            </PillButton>
                                                                        )}
                                                                        {/* Plain Link: PillLink has no router `state`, which carries the endpoints. */}
                                                                        <Link
                                                                            to={`/node/${encodeURIComponent(node.moniker)}`}
                                                                            state={{ network: node.endpoints }}
                                                                            className={pillClass("outline", "sm", detailsPillExtra)}
                                                                            aria-label={`${node.moniker} details`}
                                                                        >
                                                                            Details
                                                                        </Link>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
