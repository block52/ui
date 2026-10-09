import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { NETWORK_PRESETS, NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { useCosmosApiFactory } from "../context/CosmosApiContext";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { DiscoveredNode, discoverNodes, probeNodes, getCachedNodes, cacheNodes, clearNodeCache } from "../services/nodeDiscovery";
import { isEmpty, hasElements, hasValue } from "../utils/guards";
import { formatAgo, parseLatestBlockHeight, parseValidatorsResponse, secondsBetween, sumBigInt, type ValidatorSummary } from "../utils/nodePortal";
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

const productionNodes = NETWORK_PRESETS.filter(n => n.name !== "Localhost");

interface NodeInfo {
    status: "checking" | "online" | "offline";
    blockHeight: string | null;
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

const NodeNameCell = ({ name, tone, statusLabel, mobileRole }: { name: string; tone: DotTone; statusLabel: string; mobileRole?: React.ReactNode }) => (
    <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 shrink-0 rounded-full ring-4 ${dotClass[tone]}`} aria-hidden="true" />
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-ink text-[15px] font-medium">{name}</span>
            <span className={`text-xs ${statusTextClass[tone]}`}>{statusLabel}</span>
            {mobileRole && <span className="sm:hidden mt-1">{mobileRole}</span>}
        </div>
    </div>
);

type RoleState = { kind: "loading" } | { kind: "failed" } | { kind: "known"; isValidator: boolean };

const RolePill = ({ role }: { role: RoleState }) =>
    role.kind === "loading" ? (
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-line text-ink-muted" aria-label="Role loading">
            …
        </span>
    ) : role.kind === "failed" ? (
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-line text-ink-muted" title="Validator set could not be loaded">
            Unknown
        </span>
    ) : (
        <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                role.isValidator ? "bg-brand/20 text-brand dark:text-brand-light" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
            }`}
        >
            {role.isValidator ? "Validator" : "Sync"}
        </span>
    );

const formatHeight = (height: string): string => `#${parseInt(height).toLocaleString()}`;

const thClass = "px-4 py-3.5 first:pl-5 last:pr-5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted";
const tdClass = "px-4 py-3.5 first:pl-5 last:pr-5 whitespace-nowrap";
const rowClass = "border-t border-line hover:bg-surface-raised transition-colors";

const CheckedAgo = ({ at }: { at: number }) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [at]);

    return <span className="text-ink-muted text-sm">Checked {formatAgo(secondsBetween(at, now))}</span>;
};

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
    const [validators, setValidators] = useState<ValidatorSummary[]>([]);
    const [validatorsLoaded, setValidatorsLoaded] = useState(false);
    const [validatorsError, setValidatorsError] = useState<string | null>(null);
    const { bonds: validatorBonds, hasQuery: hasValidatorBondQuery, isLoading: isValidatorBondsLoading } = useValidatorBonds();
    const fetchValidators = useCallback(async () => {
        setValidatorsError(null);
        let lastError: unknown = null;
        for (const node of productionNodes) {
            try {
                const data = await cosmosApiFactory(node.rest).getValidatorsByStatus("BOND_STATUS_BONDED", AbortSignal.timeout(10000));
                const parsed = parseValidatorsResponse(data);
                if (parsed.skipped > 0) console.error(`Skipped ${parsed.skipped} malformed validator entries from ${node.name}`);
                setValidators(parsed.validators);
                setValidatorsLoaded(true);
                return;
            } catch (err) {
                console.error(`Failed to load validators from ${node.name}:`, err);
                lastError = err;
            }
        }
        setValidatorsError(lastError instanceof Error ? lastError.message : "No preset node answered the validator query");
    }, [cosmosApiFactory]);

    // Fuzzy: "Texas Hodl" matches "validator-texashodl".
    const isValidator = useCallback(
        (moniker: string): boolean => {
            if (!moniker || isEmpty(validators)) return false;
            const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
            const normalizedMoniker = normalize(moniker);
            return validators.some(v => {
                const normalizedValidator = normalize(v.moniker);
                return (
                    normalizedValidator.includes(normalizedMoniker) ||
                    normalizedMoniker.includes(normalizedValidator) ||
                    normalizedValidator.replace("validator", "").includes(normalizedMoniker.replace("validator", "")) ||
                    normalizedMoniker.replace("validator", "").includes(normalizedValidator.replace("validator", ""))
                );
            });
        },
        [validators]
    );

    const checkNode = useCallback(
        async (network: NetworkEndpoints): Promise<NodeInfo> => {
            try {
                const data = await cosmosApiFactory(network.rest).getLatestBlock(AbortSignal.timeout(5000));
                return { status: "online", blockHeight: parseLatestBlockHeight(data) };
            } catch (err) {
                console.error(`Node ${network.name} did not answer:`, err);
                return { status: "offline", blockHeight: null };
            }
        },
        [cosmosApiFactory]
    );

    const checkAllNodes = useCallback(async () => {
        const initialInfo: Record<string, NodeInfo> = {};
        productionNodes.forEach(n => {
            initialInfo[n.name] = { status: "checking", blockHeight: null };
        });
        setNodeInfo(initialInfo);

        const results = await Promise.all(
            productionNodes.map(async network => {
                const info = await checkNode(network);
                return { name: network.name, info };
            })
        );

        const newInfo: Record<string, NodeInfo> = {};
        results.forEach(r => {
            newInfo[r.name] = r.info;
        });
        setNodeInfo(newInfo);
        setLastCheckedAt(Date.now());
    }, [checkNode]);

    const handleDiscoverNodes = useCallback(async () => {
        setIsDiscovering(true);
        clearNodeCache();

        try {
            const discovered = await discoverNodes(productionNodes, productionNodes);

            const newDiscovered = discovered.filter(d => !d.isPreset);

            setDiscoveredNodes(newDiscovered);
            cacheNodes(newDiscovered);

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

    const handleAddToNetworks = useCallback(
        (node: DiscoveredNode) => {
            if (node.endpoints) {
                addDiscoveredNetwork(node.endpoints);
            }
        },
        [addDiscoveredNetwork]
    );

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

    const presetOnlineCount = Object.values(nodeInfo).filter(n => n.status === "online").length;
    const discoveredReachableCount = discoveredNodes.filter(n => n.probeStatus === "reachable").length;
    const totalOnline = presetOnlineCount + discoveredReachableCount;
    const totalNodes = productionNodes.length + discoveredNodes.length;

    const presetValidatorCount = productionNodes.filter(n => isValidator(n.name)).length;
    const discoveredValidatorCount = discoveredNodes.filter(n => isValidator(n.moniker)).length;
    const totalSyncNodes = totalNodes - (presetValidatorCount + discoveredValidatorCount);

    // Falls back to the highest block height when the earnings panel has no bonds.
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

    const roleOf = (moniker: string): RoleState => {
        if (validatorsLoaded) return { kind: "known", isValidator: isValidator(moniker) };
        return validatorsError === null ? { kind: "loading" } : { kind: "failed" };
    };

    return (
        <div className="min-h-screen bg-surface-page text-ink-body">
            <main className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
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

                        {validatorsError !== null && (
                            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm">
                                <span className="text-red-400">Could not load the validator set from any preset node: {validatorsError}</span>
                                <PillButton variant="outline" size="sm" onClick={fetchValidators}>
                                    Retry
                                </PillButton>
                            </div>
                        )}

                        <Card>
                            <CardHeader
                                title="Preset nodes"
                                actions={
                                    lastCheckedAt !== null && <CheckedAgo at={lastCheckedAt} />
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
                                            const status = info?.status ?? "checking";
                                            const blockHeight = info?.blockHeight;
                                            const tone: DotTone = status === "online" ? "good" : status === "offline" ? "bad" : "pending";

                                            return (
                                                <tr key={network.name} className={rowClass}>
                                                    <td className={tdClass}>
                                                        <NodeNameCell
                                                            name={network.name}
                                                            tone={tone}
                                                            statusLabel={status === "checking" ? "Checking..." : status === "online" ? "Online" : "Offline"}
                                                            mobileRole={<RolePill role={roleOf(network.name)} />}
                                                        />
                                                    </td>
                                                    <td className={`${tdClass} hidden sm:table-cell`}>
                                                        <RolePill role={roleOf(network.name)} />
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
                            <ValidatorEarningsPanel
                                bonds={validatorBonds}
                                hasQuery={hasValidatorBondQuery}
                                isLoading={isValidatorBondsLoading}
                                className="min-w-0"
                            />

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
                                                                <RolePill role={roleOf(node.moniker)} />
                                                            </td>
                                                            <td className={tdClass}>
                                                                <span
                                                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                                        node.isIpBased
                                                                            ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                                                            : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300"
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
                                                                                onClick={() => handleAddToNetworks(node)}
                                                                            >
                                                                                Add to networks
                                                                            </PillButton>
                                                                        )}
                                                                        <Link
                                                                            to={`/node/${encodeURIComponent(node.moniker)}`}
                                                                            state={{ network: node.endpoints }}
                                                                            className={pillClass("outline", "sm")}
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
