import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import type { BlockResponse } from "@block52/poker-vm-sdk";
import { isNetworkError, httpStatusText } from "../../apis/HTTPClient";
import { getCosmosClient, clearCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { formatTimestampRelative, formatProposerAddress } from "../../utils/formatUtils";
import { truncateMiddle } from "../../utils/stringUtils";
import { addressColor, averageBlockTimeSeconds, countDistinct } from "../../utils/explorerStats";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPage, ExplorerPanel, explorerRowClass, explorerThClass } from "../../components/explorer/ExplorerPanel";
import { PillButton, StatStrip, StatItem } from "../../components/ui";
import { isEmpty, hasElements } from "../../utils/guards";

const BLOCK_COUNT = 50;
const REFRESH_MS = 10000;

/** Proposer as a b52 address, or null when the header carries none. */
const proposerOf = (block: BlockResponse): string | null => {
    const raw = block.block.header.proposer_address;
    return raw ? formatProposerAddress(raw) : null;
};

export default function BlocksPage() {
    const [blocks, setBlocks] = useState<BlockResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onlyWithTxs, setOnlyWithTxs] = useState(false);
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

            const recentBlocks = await cosmosClient.getLatestBlocks(BLOCK_COUNT);
            // Sort blocks by height in descending order (newest first)
            const sortedBlocks = [...recentBlocks].sort((a, b) => parseInt(b.block.header.height) - parseInt(a.block.header.height));
            setBlocks(sortedBlocks);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            // Provide detailed, network-specific error messages
            let errorMessage = "Failed to fetch blocks";
            let suggestion = "";

            // Determine error type and provide helpful guidance
            if (message.includes("timeout")) {
                errorMessage = "Request timeout after 10 seconds";
                if (currentNetwork.name === "Localhost") {
                    suggestion = " - Check if 'ignite chain serve' is running";
                } else {
                    suggestion = " - Production network may be slow. Try localhost for development or retry in a moment";
                }
            } else if (isNetworkError(err) || message.includes("ECONNREFUSED")) {
                errorMessage = `Cannot connect to ${currentNetwork.name}`;
                if (currentNetwork.name === "Localhost") {
                    suggestion = " - Run 'ignite chain serve' in the pokerchain directory";
                } else {
                    suggestion = " - Network may be down. Try selecting a different network";
                }
            } else if (httpStatusText(err)) {
                errorMessage = `Server error: ${httpStatusText(err)}`;
                suggestion = " - The node may be restarting or under maintenance";
            } else if (message) {
                errorMessage = message;
            }

            const fullMessage = errorMessage + suggestion;

            // Graceful degradation: Keep old blocks if we have cached data
            if (hasElements(blocks)) {
                setError(`Network unavailable - showing cached data. ${fullMessage}`);
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
        const interval = setInterval(fetchBlocks, REFRESH_MS);

        return () => {
            clearInterval(interval);
            // Reset title when component unmounts
            document.title = "Block52 Chain";
        };
    }, [currentNetwork, fetchBlocks]);

    // Summary numbers, computed only from the blocks actually loaded.
    const stats = useMemo((): StatItem[] => {
        const latest = blocks[0];
        const avg = averageBlockTimeSeconds(blocks.map(b => b.block.header.time));
        const txCount = blocks.reduce((sum, b) => sum + b.block.data.txs.length, 0);
        const proposers = countDistinct(blocks.map(b => proposerOf(b) ?? ""));
        return [
            { label: "Latest block", value: latest ? `#${Number(latest.block.header.height).toLocaleString()}` : "—", tone: latest ? "default" : "muted" },
            { label: "Block time", value: avg === null ? "—" : `~${avg.toFixed(1)} s`, tone: avg === null ? "muted" : "default" },
            { label: `Txs, last ${blocks.length} blocks`, value: txCount.toLocaleString() },
            { label: "Proposers", value: proposers.toLocaleString(), suffix: proposers === 1 ? "validator" : "validators" }
        ];
    }, [blocks]);

    const visibleBlocks = useMemo(() => (onlyWithTxs ? blocks.filter(b => hasElements(b.block.data.txs)) : blocks), [blocks, onlyWithTxs]);

    const retryButton = (
        <PillButton variant="outline" size="sm" onClick={() => fetchBlocks()} disabled={loading}>
            {loading ? "Retrying…" : "Retry"}
        </PillButton>
    );

    const filterControls = (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-normal text-ink-soft">
            <label className="flex items-center gap-2 min-h-11 cursor-pointer">
                <input type="checkbox" checked={onlyWithTxs} onChange={e => setOnlyWithTxs(e.target.checked)} className="w-4 h-4 accent-brand" />
                Only blocks with transactions
            </label>
            {!error && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-[7px] h-[7px] rounded-full bg-emerald-400" aria-hidden="true" />
                    Live
                </span>
            )}
        </div>
    );

    return (
        <ExplorerPage>
            {/* First load / first-load failure: no data yet, so no stats or table. */}
            {isEmpty(blocks) ? (
                <ExplorerPanel header="Latest blocks" action={error ? retryButton : undefined}>
                    {loading && !error ? (
                        <ExplorerLoading label="Loading blocks…" />
                    ) : error ? (
                        <>
                            <ExplorerError>{error}</ExplorerError>
                            <p className="pb-6 px-4 -mt-3 text-center text-sm text-ink-muted">
                                Make sure your Block52 blockchain is running, or select a different network from the header.
                            </p>
                        </>
                    ) : (
                        <ExplorerEmpty>No blocks yet.</ExplorerEmpty>
                    )}
                </ExplorerPanel>
            ) : (
                <div className="flex flex-col gap-6">
                    <StatStrip items={stats} />

                    {/* Refresh failed, but cached blocks are still shown below. */}
                    {error && (
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-red-400/40 bg-red-400/10">
                            <span className="text-sm text-red-300">{error}</span>
                            {retryButton}
                        </div>
                    )}

                    <ExplorerPanel header={<h2 className="m-0 text-[17px] font-semibold text-ink">Latest blocks</h2>} action={filterControls}>
                        {isEmpty(visibleBlocks) ? (
                            <ExplorerEmpty>None of the last {blocks.length} blocks have transactions.</ExplorerEmpty>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className={explorerThClass}>Height</th>
                                            <th className={`${explorerThClass} hidden md:table-cell`}>Block hash</th>
                                            <th className={explorerThClass}>Txs</th>
                                            <th className={explorerThClass}>Proposer</th>
                                            <th className={`${explorerThClass} text-right`}>Age</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleBlocks.map(block => {
                                            const height = block.block.header.height;
                                            const txCount = block.block.data.txs.length;
                                            const proposer = proposerOf(block);
                                            return (
                                                <tr key={height} className={explorerRowClass}>
                                                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                                                        <Link
                                                            to={`/explorer/block/${height}`}
                                                            className="inline-flex items-center min-h-11 -my-3 font-semibold tabular-nums text-ink hover:text-brand-light"
                                                        >
                                                            #{Number(height).toLocaleString()}
                                                        </Link>
                                                    </td>
                                                    <td className="hidden md:table-cell px-4 sm:px-5 py-3 whitespace-nowrap font-mono text-[13px] text-ink-muted" title={block.block_id.hash}>
                                                        {truncateMiddle(block.block_id.hash, 8, 8, "…")}
                                                    </td>
                                                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                                                        <span
                                                            className={`inline-block min-w-6 px-2 py-0.5 rounded-full text-center text-xs font-semibold tabular-nums ${
                                                                txCount > 0 ? "bg-emerald-400/15 text-emerald-400" : "bg-surface-raised text-ink-muted"
                                                            }`}
                                                        >
                                                            {txCount}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                                                        {proposer ? (
                                                            <span className="flex items-center gap-2" title={proposer}>
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                                                                    style={{ backgroundColor: addressColor(proposer) }}
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="font-mono text-[13px] text-ink-soft">{truncateMiddle(proposer, 8, 6, "…")}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-ink-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap text-right text-ink-muted tabular-nums">
                                                        {formatTimestampRelative(block.block.header.time)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="px-4 sm:px-5 py-3.5 border-t border-line text-sm text-ink-muted">
                            Showing the latest {blocks.length} blocks · new blocks appear at the top every few seconds
                        </div>
                    </ExplorerPanel>
                </div>
            )}
        </ExplorerPage>
    );
}
