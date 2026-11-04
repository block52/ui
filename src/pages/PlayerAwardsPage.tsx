import { useEffect } from "react";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel, ExplorerReloadButton } from "../components/explorer/ExplorerPanel";
import { AwardCard } from "../components/players/AwardCard";
import { usePlayerAwards } from "../hooks/player/usePlayerAwards";
import { isEmpty } from "../utils/guards";
import { MIN_AWARD_DECISIONS, MIN_AWARD_HANDS, MIN_AWARD_MONEY_ACTIONS } from "../utils/playerAwards";

export default function PlayerAwardsPage() {
    const { awards, rankedPlayers, failedPlayers, loading, error, refetch } = usePlayerAwards();

    useEffect(() => {
        document.title = "Player Awards - Block52 Explorer";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />

            <div className="max-w-5xl mx-auto relative z-10">
                <ExplorerHeader title="Player Awards" />

                <ExplorerPanel
                    header={`Awards${!loading && !error && rankedPlayers > 0 ? ` · ${rankedPlayers.toLocaleString()} players ranked` : ""}`}
                    action={<ExplorerReloadButton onClick={refetch} busy={loading} />}
                >
                    {loading ? (
                        <ExplorerLoading label="Counting every fold…" />
                    ) : error ? (
                        <ExplorerError>{error}</ExplorerError>
                    ) : isEmpty(awards) ? (
                        <ExplorerEmpty>Nobody has played enough to win anything yet.</ExplorerEmpty>
                    ) : (
                        <div className="p-3 sm:p-4">
                            {failedPlayers > 0 && (
                                <p role="status" className="mb-3 text-sm text-yellow-400">
                                    {failedPlayers.toLocaleString()} players couldn't be loaded, so some awards may be off. Reload to try again.
                                </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                {awards.map(award => (
                                    <AwardCard key={award.id} award={award} />
                                ))}
                            </div>
                        </div>
                    )}
                </ExplorerPanel>

                <p className="mt-4 text-xs text-gray-400">
                    Ranked from the actions the indexer records on chain. A decision is a fold, check, call, bet or raise. Wallets need {MIN_AWARD_DECISIONS}{" "}
                    decisions to be ranked, {MIN_AWARD_MONEY_ACTIONS} bets, raises and calls for the aggression awards, and {MIN_AWARD_HANDS} hands for the
                    win-rate awards. Hand counts start in mid-October 2026 and leave out hands with no winnings recorded. There's no biggest winner or loser
                    yet, because the indexer doesn't record tournament prizes.
                </p>
            </div>
        </div>
    );
}
