import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerHeader } from "../components/explorer/ExplorerHeader";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel, ExplorerReloadButton } from "../components/explorer/ExplorerPanel";
import { useCosmosWallet } from "../hooks/wallet";
import { useNetwork } from "../context/NetworkContext";
import { useMyHandHistory } from "../hooks/player/useMyHandHistory";
import { useIndexerStatus } from "../hooks/player/useIndexerStatus";
import { useTableFormats } from "../hooks/player/useTableFormats";
import { describeHandOutcome, describeIndexing, handKey, HandOutcomeTone } from "../utils/handHistory";
import { formatTimestampRelative } from "../utils/formatUtils";
import { truncateMiddle } from "../utils/stringUtils";
import { getCardImageUrl } from "../utils/cardImages";
import { hasElements, isEmpty } from "../utils/guards";
import type { PlayerHand } from "../types/players";
import styles from "./explorer/AllAccountsPage.module.css";

const PAGE_SIZE = 25;

const toneClass: Record<HandOutcomeTone, string> = {
    won: "text-green-400 font-semibold",
    lost: "text-red-400",
    neutral: "text-gray-300"
};

/**
 * "My Hand History" (ui#721): every indexed hand the wallet in use played,
 * across tables and sessions, newest first. Each opens its read-only replay.
 */
export default function MyHandsPage() {
    const { address } = useCosmosWallet();
    const { currentNetwork } = useNetwork();
    const indexerStatus = useIndexerStatus();
    const { hands, total, loading, error, hasMore, loadMore, reload } = useMyHandHistory(
        address,
        `${currentNetwork.name}|${currentNetwork.rest}`,
        PAGE_SIZE
    );
    const formats = useTableFormats(useMemo(() => hands.map(h => h.game_id), [hands]));

    useEffect(() => {
        document.title = "My Hands - Block52";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const header = (
        <span className="flex items-center gap-2 min-w-0">
            <span>My hands{total > 0 ? ` · ${total.toLocaleString()}` : ""}</span>
            {address && (
                <Link to={`/players/${address}`} title={address} className={`font-mono text-xs truncate hover:underline ${styles.brandText}`}>
                    {truncateMiddle(address, 10, 6)}
                </Link>
            )}
        </span>
    );

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />

            <div className="max-w-5xl mx-auto relative z-10">
                <ExplorerHeader title="My Hands" />

                {indexerStatus && <p className="mb-4 text-xs sm:text-sm text-gray-400 text-center">{describeIndexing(indexerStatus)}</p>}

                <ExplorerPanel header={header} action={address ? <ExplorerReloadButton onClick={reload} busy={loading} label="Reload hands" /> : null}>
                    {!address ? (
                        <ExplorerEmpty>
                            No Block52 wallet on this device.{" "}
                            <Link to="/wallet" className={`hover:underline ${styles.brandText}`}>
                                Create or import one
                            </Link>{" "}
                            to see the hands you&apos;ve played.
                        </ExplorerEmpty>
                    ) : error && isEmpty(hands) ? (
                        <ExplorerError>{error}</ExplorerError>
                    ) : loading && isEmpty(hands) ? (
                        <ExplorerLoading label="Loading your hands…" />
                    ) : isEmpty(hands) ? (
                        <ExplorerEmpty>No indexed hands for this wallet yet.</ExplorerEmpty>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {hands.map(hand => (
                                <HandRow key={handKey(hand)} hand={hand} outcome={describeHandOutcome(hand, formats.get(hand.game_id))} />
                            ))}
                        </ul>
                    )}

                    {address && hasElements(hands) && (
                        <div className="px-3 sm:px-4 py-3 flex flex-col items-center gap-2 border-t border-white/5">
                            {error && <p className="text-sm text-red-400">{error}</p>}
                            <p className="text-xs text-gray-400">
                                Showing {hands.length.toLocaleString()} of {total.toLocaleString()}
                            </p>
                            {hasMore && (
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="px-4 py-1.5 rounded-lg text-sm text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                                >
                                    {loading ? "Loading…" : "Load more"}
                                </button>
                            )}
                        </div>
                    )}
                </ExplorerPanel>
            </div>
        </div>
    );
}

function HandRow({ hand, outcome }: { hand: PlayerHand; outcome: { label: string; tone: HandOutcomeTone } }) {
    const replayUrl = `/table/${hand.game_id}?hand=${hand.hand_number}`;
    return (
        <li className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <Link to={replayUrl} className="text-white font-semibold hover:underline">
                        Hand #{hand.hand_number}
                    </Link>
                    <span className="text-xs text-gray-400">Seat {hand.seat}</span>
                    <span className={`text-sm ${toneClass[outcome.tone]}`}>{outcome.label}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400 truncate">
                    Table{" "}
                    <span className="font-mono" title={hand.game_id}>
                        {truncateMiddle(hand.game_id, 8, 6)}
                    </span>
                    {" · "}
                    {hand.ended_at ? formatTimestampRelative(hand.ended_at) : `block ${hand.block_height.toLocaleString()}`}
                </p>
            </div>
            {hasElements(hand.community_cards) && (
                <div className="flex gap-1 shrink-0" aria-label={`Board ${hand.community_cards.join(" ")}`}>
                    {hand.community_cards.map((card, i) => (
                        <img key={i} src={getCardImageUrl(card.toUpperCase())} alt={card} className="w-6 sm:w-7 rounded-sm" />
                    ))}
                </div>
            )}
            <div className="flex gap-3 shrink-0 text-sm">
                <Link to={replayUrl} className={`hover:underline ${styles.brandText}`}>
                    Replay
                </Link>
                <Link to={`/explorer/hand/${hand.game_id}/${hand.hand_number}`} className="text-gray-300 hover:underline">
                    Details
                </Link>
            </div>
        </li>
    );
}
