import { useEffect, useState, useCallback, useMemo } from "react";
import { Chart } from "react-chartjs-2";
import {
    Chart as ChartJS,
    BarController,
    BarElement,
    CategoryScale,
    ChartData,
    ChartOptions,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    TooltipItem
} from "chart.js";
import { CardStats, StatsSummary, RandomnessReport, IndexerStatus, ChiSquaredResult } from "./types";
import { ExplorerError, ExplorerLoading, ExplorerPage, ExplorerPanel } from "../../components/explorer/ExplorerPanel";
import { Card, PillButton, StatStrip, StatItem } from "../../components/ui";
import { useIndexerApi } from "../../context/IndexerApiContext";
import {
    CHART_GRID_COLOR,
    CHART_TICK_COLOR,
    EXPECTED_LINE_COLOR,
    SUIT_GROUPS,
    TestBadge,
    Verdict,
    cardLabel,
    chiSquaredBadge,
    distributionVerdict,
    formatChiSquared,
    isIndexerSynced,
    sortCardsBySuit,
    suitColor
} from "../../utils/cardDistribution";
import styles from "./DistributionPage.module.css";

ChartJS.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

const TITLE = "Hand Distribution";
const SUBTITLE = "How often each card has been dealt across every indexed hand. A fair shuffle deals every card about equally often.";

const badgeStyle: Record<TestBadge, { label: string; className: string }> = {
    pass: { label: "Pass", className: "bg-emerald-400/15 text-emerald-400" },
    marginal: { label: "Marginal", className: "bg-amber-400/15 text-amber-300" },
    fail: { label: "Fail", className: "bg-red-400/15 text-red-400" },
    noData: { label: "No data", className: "bg-surface-hover text-ink-soft" }
};

const verdictItem: Record<Verdict, Pick<StatItem, "value" | "tone">> = {
    fair: { value: "Looks fair", tone: "good" },
    bias: { value: "Possible bias", tone: "bad" },
    waiting: { value: "Waiting for data", tone: "muted" }
};

/** One chart slot: a card, or a gap between suit groups. */
type Slot = { card: CardStats } | { gap: true };

export default function DistributionPage() {
    const [cardStats, setCardStats] = useState<CardStats[]>([]);
    const [summary, setSummary] = useState<StatsSummary | null>(null);
    const [randomness, setRandomness] = useState<RandomnessReport | null>(null);
    const [indexerStatus, setIndexerStatus] = useState<IndexerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const indexerApi = useIndexerApi();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Card stats are the primary data for the chart.
            const cardsRes = await indexerApi.getCardStats();
            setCardStats(cardsRes as CardStats[]);

            // Indexer sync status (non-critical)
            try {
                const statusRes = await indexerApi.getSyncStatus();
                setIndexerStatus(statusRes as IndexerStatus);
            } catch (err) {
                console.error("Failed to fetch indexer status:", err);
            }

            // Summary stats (non-critical)
            try {
                const summaryRes = await indexerApi.getSummaryStats();
                setSummary(summaryRes as StatsSummary);
            } catch (err) {
                console.error("Failed to fetch summary stats:", err);
            }

            // Randomness analysis (non-critical)
            try {
                const randomnessRes = await indexerApi.getRandomnessAnalysis();
                setRandomness(randomnessRes as RandomnessReport);
            } catch (err) {
                console.error("Failed to fetch randomness analysis:", err);
            }

            setLoading(false);
        } catch (err) {
            console.error("Error fetching card distribution:", err);
            setError("Unable to load distribution data from the indexer. Please try again later.");
            setLoading(false);
        }
    }, [indexerApi]);

    useEffect(() => {
        (async () => {
            await fetchData();
        })();
    }, [fetchData]);

    useEffect(() => {
        document.title = "Hand Distribution - Block52 Explorer";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const totalCardsDealt = useMemo(() => cardStats.reduce((sum, c) => sum + c.total_appearances, 0), [cardStats]);
    const expectedPerCard = totalCardsDealt / 52;

    // Hands indexed: the summary endpoint, else the status endpoint (both report total_hands).
    const handsIndexed = summary ? summary.total_hands : indexerStatus ? indexerStatus.total_hands : null;

    const verdict = distributionVerdict(randomness ? randomness.card_chi_squared.result : null, totalCardsDealt);

    const stats: StatItem[] = [
        { label: "Hands indexed", value: handsIndexed === null ? "—" : handsIndexed.toLocaleString(), tone: handsIndexed === null ? "muted" : "default" },
        { label: "Cards dealt", value: totalCardsDealt.toLocaleString() },
        { label: "Expected per card", value: totalCardsDealt > 0 ? Math.round(expectedPerCard).toLocaleString() : "—", tone: totalCardsDealt > 0 ? "default" : "muted" },
        { label: "Verdict", ...verdictItem[verdict] }
    ];

    // Suit groups (S, H, D, C) separated by an empty slot so the bars read as four clusters.
    const slots = useMemo((): Slot[] => {
        const sorted = sortCardsBySuit(cardStats);
        return sorted.flatMap((card, i): Slot[] =>
            i > 0 && sorted[i - 1].suit.toLowerCase() !== card.suit.toLowerCase() ? [{ gap: true }, { card }] : [{ card }]
        );
    }, [cardStats]);

    const chartData = useMemo(
        (): ChartData<"bar" | "line", (number | null)[], string> => ({
            labels: slots.map(s => ("card" in s ? s.card.rank.toUpperCase() : "")),
            datasets: [
                {
                    type: "bar" as const,
                    label: "Times dealt",
                    data: slots.map(s => ("card" in s ? s.card.total_appearances : null)),
                    backgroundColor: slots.map(s => ("card" in s ? suitColor(s.card.suit) : "transparent")),
                    borderRadius: 2,
                    categoryPercentage: 0.9,
                    barPercentage: 0.9,
                    order: 2
                },
                {
                    type: "line" as const,
                    label: "Expected",
                    data: slots.map(() => expectedPerCard),
                    borderColor: EXPECTED_LINE_COLOR,
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    order: 1
                }
            ]
        }),
        [slots, expectedPerCard]
    );

    const chartOptions = useMemo(
        (): ChartOptions<"bar" | "line"> => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (item: TooltipItem<"bar" | "line">) => "card" in slots[item.dataIndex],
                    callbacks: {
                        title: (items: TooltipItem<"bar" | "line">[]) => {
                            const slot = slots[items[0].dataIndex];
                            return "card" in slot ? cardLabel(slot.card) : "";
                        },
                        label: (item: TooltipItem<"bar" | "line">) =>
                            item.dataset.type === "line" ? `Expected: ${expectedPerCard.toFixed(1)}` : `Dealt: ${item.formattedValue} times`,
                        afterLabel: (item: TooltipItem<"bar" | "line">) => {
                            if (item.dataset.type === "line" || item.parsed.y === null) return "";
                            return `${((item.parsed.y / totalCardsDealt) * 100).toFixed(2)}% of all dealt cards`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: CHART_GRID_COLOR },
                    ticks: { color: CHART_TICK_COLOR, autoSkip: false, maxRotation: 0, font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: CHART_GRID_COLOR },
                    border: { display: false },
                    ticks: { color: CHART_TICK_COLOR, font: { size: 11 } }
                }
            }
        }),
        [slots, expectedPerCard, totalCardsDealt]
    );

    const syncPill = indexerStatus && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-line bg-surface-card text-sm text-ink-soft tabular-nums">
            <span className={`w-2 h-2 rounded-full ${isIndexerSynced(indexerStatus) ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
            {isIndexerSynced(indexerStatus) ? "Indexer synced to" : "Indexer syncing ·"} #{indexerStatus.last_block_indexed.toLocaleString()}
            {!isIndexerSynced(indexerStatus) && ` of #${indexerStatus.total_blocks.toLocaleString()}`} · {indexerStatus.total_hands.toLocaleString()} hands
        </div>
    );

    const tests: { name: string; result: ChiSquaredResult | null }[] = [
        { name: "Card distribution", result: randomness ? randomness.card_chi_squared : null },
        { name: "Suit distribution", result: randomness ? randomness.suit_chi_squared : null },
        { name: "Rank distribution", result: randomness ? randomness.rank_chi_squared : null }
    ];

    return (
        <ExplorerPage title={TITLE} subtitle={SUBTITLE}>
            {loading ? (
                <ExplorerPanel>
                    <ExplorerLoading label="Loading distribution data…" />
                </ExplorerPanel>
            ) : error ? (
                <ExplorerPanel
                    header="Hand distribution"
                    action={
                        <PillButton variant="outline" size="sm" onClick={fetchData}>
                            Retry
                        </PillButton>
                    }
                >
                    <ExplorerError>{error}</ExplorerError>
                </ExplorerPanel>
            ) : (
                <div className="flex flex-col gap-6">
                    {syncPill && <div className="flex">{syncPill}</div>}

                    <StatStrip items={stats} />

                    {/* Chart */}
                    <Card className="p-4 sm:p-6 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="m-0 text-[17px] font-semibold text-ink">Times each card was dealt</h2>
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 m-0 p-0 list-none text-[13px] text-ink-soft">
                                {SUIT_GROUPS.map(g => (
                                    <li key={g.key} className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: g.color }} aria-hidden="true" />
                                        {g.name}
                                    </li>
                                ))}
                                <li className="flex items-center gap-1.5">
                                    <span className={`w-4 ${styles.expectedSwatch}`} aria-hidden="true" />
                                    Expected
                                </li>
                            </ul>
                        </div>
                        {totalCardsDealt === 0 ? (
                            <div className="h-60 rounded-xl border border-dashed border-line-strong flex flex-col items-center justify-center gap-2 px-6 text-center">
                                <p className="m-0 font-medium text-ink-body">No card data indexed yet</p>
                                <p className="m-0 max-w-md text-ink-muted leading-normal">
                                    {handsIndexed !== null && handsIndexed > 0
                                        ? `${handsIndexed.toLocaleString()} hands are indexed, but none have revealed cards to count. The chart fills in as hands reach showdown.`
                                        : "No indexed hands have revealed cards to count. The chart fills in as hands reach showdown."}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <div className={`min-w-[760px] ${styles.chartContainer}`}>
                                    <Chart type="bar" data={chartData} options={chartOptions} aria-label="Bar chart of times each card was dealt, grouped by suit" role="img" />
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Chi-squared randomness tests */}
                    <section className="flex flex-col gap-3.5">
                        <h2 className="m-0 text-[17px] font-semibold text-ink">
                            Randomness tests <span className="text-ink-muted font-normal">· chi-squared</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {tests.map(test => {
                                const badge = test.result ? chiSquaredBadge(test.result.result) : "noData";
                                const hasNumbers = test.result !== null && badge !== "noData";
                                return (
                                    <Card key={test.name} as="div" className="p-5 flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-ink">{test.name}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStyle[badge].className}`}>
                                                {badgeStyle[badge].label}
                                            </span>
                                        </div>
                                        <span className="text-ink-soft leading-snug">
                                            {test.result ? test.result.interpretation : "Randomness analysis is unavailable from the indexer."}
                                        </span>
                                        <span className="font-mono text-xs text-ink-muted">{hasNumbers && test.result ? formatChiSquared(test.result) : "—"}</span>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>

                    <details className="bg-surface-card border border-line rounded-2xl px-5 sm:px-6 py-4">
                        <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-ink">How Block52 shuffles, and how to read this page</summary>
                        <ul className="mt-3 mb-1 pl-5 max-w-3xl list-disc text-ink-soft leading-relaxed">
                            <li>Each deck is shuffled from the block hash, so every validator gets the same deck and anyone can re-check it.</li>
                            <li>
                                Expected per card is total cards dealt divided by 52
                                {totalCardsDealt > 0 ? ` (${expectedPerCard.toFixed(1)} right now)` : ""}. Bars should sit near the dashed line, within
                                statistical variance.
                            </li>
                            <li>A p-value above 0.05 means the counts are consistent with a fair shuffle.</li>
                            <li>All deck shuffles are on-chain and auditable. No single party can manipulate the card distribution.</li>
                        </ul>
                    </details>
                </div>
            )}
        </ExplorerPage>
    );
}
