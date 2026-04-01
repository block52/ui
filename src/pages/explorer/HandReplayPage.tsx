import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";
import { getCardImageUrl } from "../../utils/cardImages";
import type { HandDetail, HandListItem, HandListResponse } from "./types";
import { useIndexerApi } from "../../context/IndexerApiContext";

export default function HandReplayPage() {
    const { gameId, handNumber } = useParams<{ gameId: string; handNumber: string }>();

    const [hand, setHand] = useState<HandDetail | null>(null);
    const [hands, setHands] = useState<HandListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const indexerApi = useIndexerApi();

    const fetchHand = useCallback(async () => {
        if (!gameId) {
            setError("No game ID provided. URL format: /explorer/hand/{gameId}/{handNumber}");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Always fetch the hands list for this game
            try {
                const listRes = (await indexerApi.getHands(gameId)) as HandListResponse;
                if (listRes.data) {
                    setHands(listRes.data);
                }
            } catch {
                // Non-critical
            }

            // If no hand number, show the list only
            if (!handNumber) {
                setLoading(false);
                return;
            }

            const res = (await indexerApi.getHand(gameId, handNumber)) as HandDetail;
            if (!res) throw new Error(`Hand not found (${handNumber})`);
            setHand(res);

            setLoading(false);
        } catch (err) {
            console.error("Error fetching hand:", err);
            setError("Unable to load hand data. Please check the URL and try again.");
            setLoading(false);
        }
    }, [gameId, handNumber]);

    useEffect(() => {
        fetchHand();
    }, [fetchHand]);

    // Parse community and hole cards from revealed_cards
    const communityCards = useMemo(() => {
        if (!hand?.revealed_cards) return [];
        return hand.revealed_cards
            .filter(c => c.card_type === "community")
            .sort((a, b) => a.position - b.position)
            .map(c => c.card.toUpperCase());
    }, [hand?.revealed_cards]);

    const holeCards = useMemo(() => {
        if (!hand?.revealed_cards) return [];
        return hand.revealed_cards
            .filter(c => c.card_type === "hole")
            .sort((a, b) => a.position - b.position)
            .map(c => c.card.toUpperCase());
    }, [hand?.revealed_cards]);

    // Parse the full deck string: "[AC]-JC-6D-7D-..."
    const deckCards = useMemo(() => {
        if (!hand?.deck) return [];
        return hand.deck.replace(/[[\]]/g, "").split("-");
    }, [hand?.deck]);

    // Sorted hand list for navigation
    const sortedHands = useMemo(() => {
        return [...hands].sort((a, b) => a.hand_number - b.hand_number);
    }, [hands]);

    const currentHandNum = Number(handNumber);

    const truncateId = (id: string) => {
        if (id.length <= 14) return id;
        return `${id.slice(0, 8)}...${id.slice(-4)}`;
    };

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
                <ExplorerHeader title="Hand Replay" />

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-lg text-white">Loading hand data...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <div className="bg-red-900/30 rounded-lg p-6 border border-red-700 inline-block">
                            <p className="text-lg text-red-300">{error}</p>
                            <button onClick={fetchHand} className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors">
                                Retry
                            </button>
                        </div>
                    </div>
                ) : !handNumber && hands.length > 0 ? (
                    /* Hands list mode — no hand number in URL */
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-2xl font-bold text-white mb-2">Hands for Game</h2>
                        <p className="text-gray-400 font-mono text-sm mb-6">{gameId}</p>
                        <p className="text-gray-300 mb-4">
                            {hands.length} hand{hands.length !== 1 ? "s" : ""} found
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {[...hands]
                                .sort((a, b) => a.hand_number - b.hand_number)
                                .map(h => (
                                    <Link
                                        key={h.hand_number}
                                        to={`/explorer/hand/${h.game_id}/${h.hand_number}`}
                                        className="px-3 py-1.5 rounded text-sm transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
                                    >
                                        Hand #{h.hand_number}
                                    </Link>
                                ))}
                        </div>
                    </div>
                ) : !handNumber ? (
                    <div className="text-center py-12">
                        <p className="text-lg text-gray-400">No hands found for this game.</p>
                    </div>
                ) : hand ? (
                    <>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white">Hand #{hand.hand_number}</h2>
                        </div>

                        {/* Hand Info Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400">Game ID</p>
                                    <p className="text-white font-mono text-sm">{truncateId(hand.game_id)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Block Height</p>
                                    <Link to={`/explorer/block/${hand.block_height}`} className="text-blue-400 hover:text-blue-300">
                                        #{hand.block_height.toLocaleString()}
                                    </Link>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Played</p>
                                    <p className="text-white">{new Date(hand.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            {hand.deck_seed && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-400">Deck Seed (Verifiable)</p>
                                    <p className="text-white font-mono text-xs break-all">{hand.deck_seed}</p>
                                </div>
                            )}
                        </div>

                        {/* Community Cards */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Community Cards</h3>
                            {communityCards.length > 0 ? (
                                <div className="flex gap-3">
                                    {communityCards.map((card, idx) => (
                                        <img key={idx} src={getCardImageUrl(card)} alt={card} className="w-[70px] h-[105px] rounded shadow-lg" />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400">No community cards revealed</p>
                            )}
                        </div>

                        {/* Revealed Hole Cards */}
                        {holeCards.length > 0 && (
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Revealed Hole Cards</h3>
                                <div className="flex gap-3">
                                    {holeCards.map((card, idx) => (
                                        <img key={idx} src={getCardImageUrl(card)} alt={card} className="w-[70px] h-[105px] rounded shadow-lg" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hand Result */}
                        {hand.result && (
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Result</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-400">Winner(s)</p>
                                        <p className="text-green-400 font-semibold">
                                            {hand.result.winner_count} winner{hand.result.winner_count !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">Result Recorded</p>
                                        <p className="text-white">{new Date(hand.result.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Full Deck (Provably Fair) */}
                        {deckCards.length > 0 && (
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Full Deck (Provably Fair)</h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    The complete shuffled deck derived from the on-chain seed. Verify this against the block hash.
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {deckCards.map((card, idx) => (
                                        <img key={idx} src={getCardImageUrl(card)} alt={card} className="w-[45px] h-[67px] rounded shadow" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hand Navigation */}
                        {sortedHands.length > 1 && (
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-lg font-semibold text-white mb-4">All Hands in This Game ({sortedHands.length})</h3>
                                <div className="flex flex-wrap gap-2">
                                    {sortedHands.map(h => (
                                        <Link
                                            key={h.hand_number}
                                            to={`/explorer/hand/${h.game_id}/${h.hand_number}`}
                                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                                h.hand_number === currentHandNum ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        >
                                            Hand #{h.hand_number}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}
