import { useEffect, useState, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { CardStats, StatsSummary, RandomnessReport, IndexerStatus } from "./types";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";
import styles from "./DistributionPage.module.css";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || "https://indexer.block52.xyz";

export default function DistributionPage() {
    const [cardStats, setCardStats] = useState<CardStats[]>([]);
    const [summary, setSummary] = useState<StatsSummary | null>(null);
    const [randomness, setRandomness] = useState<RandomnessReport | null>(null);
    const [indexerStatus, setIndexerStatus] = useState<IndexerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch card stats (primary data for chart)
            const cardsRes = await fetch(`${INDEXER_URL}/api/v1/stats/cards`);
            if (!cardsRes.ok) {
                throw new Error(`Failed to fetch card stats: ${cardsRes.status}`);
            }
            const cardsData: CardStats[] = await cardsRes.json();
            setCardStats(cardsData);

            // Fetch indexer sync status (non-critical — fail silently)
            try {
                const statusRes = await fetch(`${INDEXER_URL}/api/v1/status`);
                if (statusRes.ok) {
                    const statusData: IndexerStatus = await statusRes.json();
                    setIndexerStatus(statusData);
                }
            } catch {
                // Status endpoint unavailable — not critical
            }

            // Fetch summary stats (non-critical — fail silently)
            try {
                const summaryRes = await fetch(`${INDEXER_URL}/api/v1/stats/summary`);
                if (summaryRes.ok) {
                    const summaryData: StatsSummary = await summaryRes.json();
                    setSummary(summaryData);
                }
            } catch {
                // Summary endpoint unavailable — not critical
            }

            // Fetch randomness analysis (non-critical — fail silently)
            try {
                const randomnessRes = await fetch(`${INDEXER_URL}/api/v1/analysis/randomness`);
                if (randomnessRes.ok) {
                    const randomnessData: RandomnessReport = await randomnessRes.json();
                    setRandomness(randomnessData);
                }
            } catch {
                // Randomness endpoint unavailable — not critical
            }

            setLoading(false);
        } catch (err) {
            console.error("Error fetching card distribution:", err);
            setError("Unable to load distribution data from the indexer. Please try again later.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Derive totals from card stats
    const totalCardsDealt = cardStats.reduce((sum, c) => sum + c.total_appearances, 0);

    // Prepare data for Chart.js
    const chartData = {
        labels: cardStats.map(c => c.card),
        datasets: [
            {
                label: "Card Frequency",
                data: cardStats.map(c => c.total_appearances),
                backgroundColor: "rgba(75, 192, 192, 0.6)",
                borderColor: "rgba(75, 192, 192, 1)",
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const
            },
            title: {
                display: true,
                text: "Card Distribution Across All Games (Proves Randomness)",
                color: "#ffffff"
            },
            tooltip: {
                callbacks: {
                    afterLabel: (context: { parsed: { y: number | null } }) => {
                        if (totalCardsDealt === 0 || context.parsed.y == null) return "";
                        const percentage = ((context.parsed.y / totalCardsDealt) * 100).toFixed(2);
                        return `${percentage}% of total dealt cards`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: "Card",
                    color: "#ffffff"
                },
                ticks: {
                    color: "#ffffff"
                }
            },
            y: {
                title: {
                    display: true,
                    text: "Frequency (Times Dealt)",
                    color: "#ffffff"
                },
                beginAtZero: true,
                ticks: {
                    color: "#ffffff"
                }
            }
        }
    };

    const getResultBadge = (result: string) => {
        switch (result) {
            case "PASS":
                return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-600 text-white">PASS</span>;
            case "MARGINAL":
                return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-600 text-white">MARGINAL</span>;
            case "FAIL":
                return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-600 text-white">FAIL</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-600 text-white">{result}</span>;
        }
    };

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                <ExplorerHeader title="Block Explorer" />

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-lg text-white">Loading distribution data...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <div className="bg-red-900/30 rounded-lg p-6 border border-red-700 inline-block">
                            <p className="text-lg text-red-300">{error}</p>
                            <button
                                onClick={fetchData}
                                className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Indexer Sync Progress */}
                        {indexerStatus && (
                            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700 mb-8">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-white">Indexer Sync Progress</h3>
                                    <span className="text-sm text-gray-400">
                                        {indexerStatus.blocks_indexed.toLocaleString()} / {indexerStatus.total_blocks.toLocaleString()} blocks
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="h-4 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.min(indexerStatus.percent_complete, 100)}%`,
                                            backgroundColor: indexerStatus.percent_complete >= 100 ? "#10b981" : "#3b82f6"
                                        }}
                                    />
                                </div>
                                <div className="mt-2 text-xs text-gray-400">
                                    <span>{indexerStatus.percent_complete.toFixed(1)}% complete</span>
                                </div>
                                <div className="flex gap-6 mt-3 text-xs text-gray-500">
                                    <span>Hands: {indexerStatus.total_hands.toLocaleString()}</span>
                                    <span>Games: {indexerStatus.total_games.toLocaleString()}</span>
                                    <span>Last block: #{indexerStatus.last_block_indexed.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
                                <h3 className="text-sm font-medium text-gray-400">
                                    {summary ? "Unique Games" : "Total Cards in Deck"}
                                </h3>
                                <p className="text-3xl font-bold mt-2 text-white">
                                    {summary ? summary.unique_games.toLocaleString() : "52"}
                                </p>
                            </div>
                            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
                                <h3 className="text-sm font-medium text-gray-400">Total Cards Dealt</h3>
                                <p className="text-3xl font-bold mt-2 text-white">{totalCardsDealt.toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
                                <h3 className="text-sm font-medium text-gray-400">Expected Per Card</h3>
                                <p className="text-3xl font-bold mt-2 text-white">
                                    {totalCardsDealt > 0 ? (totalCardsDealt / 52).toFixed(1) : "0"}
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
                            <div className={styles.chartContainer}>
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                        </div>


                        {/* Chi-Squared Randomness Result */}
                        {randomness && (
                            <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h2 className="text-xl font-bold mb-4 text-white">Randomness Analysis (Chi-Squared Test)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-medium text-gray-400">Card Distribution</h3>
                                            {getResultBadge(randomness.card_chi_squared.result)}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-2">{randomness.card_chi_squared.interpretation}</p>
                                        <p className="text-xs text-gray-500 mt-1">p-value: {randomness.card_chi_squared.p_value.toFixed(4)}</p>
                                    </div>
                                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-medium text-gray-400">Suit Distribution</h3>
                                            {getResultBadge(randomness.suit_chi_squared.result)}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-2">{randomness.suit_chi_squared.interpretation}</p>
                                        <p className="text-xs text-gray-500 mt-1">p-value: {randomness.suit_chi_squared.p_value.toFixed(4)}</p>
                                    </div>
                                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-medium text-gray-400">Rank Distribution</h3>
                                            {getResultBadge(randomness.rank_chi_squared.result)}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-2">{randomness.rank_chi_squared.interpretation}</p>
                                        <p className="text-xs text-gray-500 mt-1">p-value: {randomness.rank_chi_squared.p_value.toFixed(4)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Explanation */}
                        <div className="mt-8 bg-blue-900/20 rounded-lg p-6 border border-blue-800">
                            <h2 className="text-xl font-bold mb-3 text-white">How to Read This Chart</h2>
                            <ul className="space-y-2 text-sm text-gray-300">
                                <li>
                                    <strong className="text-white">Randomness Check</strong>: If the distribution is fair, each card should appear roughly the
                                    same number of times (within statistical variance).
                                </li>
                                <li>
                                    <strong className="text-white">Expected Frequency</strong>: {totalCardsDealt > 0 ? (totalCardsDealt / 52).toFixed(1) : "N/A"}{" "}
                                    times per card (total dealt / 52 cards).
                                </li>
                                <li>
                                    <strong className="text-white">Block52 Shuffling</strong>: Decks are shuffled using deterministic block hash,
                                    ensuring verifiable randomness across all validators.
                                </li>
                                <li>
                                    <strong className="text-white">Transparency</strong>: All deck shuffles are on-chain and auditable. No single party can
                                    manipulate card distribution.
                                </li>
                            </ul>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
