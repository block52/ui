/**
 * @jest-environment node
 */
import { IndexerApi } from "../apis/Api";
import { ChiSquaredResult, HandListItem, HandResult, RevealedCard } from "../pages/explorer/types";

describe("Indexer API E2E Tests", () => {
    const indexerApi = new IndexerApi({ baseUrl: "https://indexer.block52.xyz", secure: false });
    beforeAll(async () => {
        // Setup: Clean up any test data if needed
    });

    afterAll(async () => {
        // Cleanup: Remove test payment records
    });

    describe("Get Card Stats", () => {
        it("should get card stats", async () => {
            const response = (await indexerApi.getCardStats()) as CardStats[];
            expect(response).toBeDefined();
            expect(Array.isArray(response)).toBe(true);
            if (response.length > 0) {
                const stat = response[0];
                expect(stat.card).toBeDefined();
                expect(stat.rank).toBeDefined();
                expect(stat.suit).toBeDefined();
                expect(stat.total_appearances).toBeDefined();
                expect(stat.expected_frequency).toBeDefined();
                expect(stat.actual_frequency).toBeDefined();
                expect(stat.deviation).toBeDefined();
                expect(stat.deviation_percent).toBeDefined();
            }
        });
    });

    describe("Get Sync Status", () => {
        it("should get sync status", async () => {
            const response = (await indexerApi.getSyncStatus()) as IndexerStatus;
            expect(response).toBeDefined();
            expect(response.blocks_indexed).toBeDefined();
            expect(typeof response.blocks_indexed).toBe("number");
            expect(response.total_blocks).toBeDefined();
            expect(typeof response.total_blocks).toBe("number");
            expect(response.percent_complete).toBeDefined();
            expect(typeof response.percent_complete).toBe("number");
            expect(response.last_block_indexed).toBeDefined();
            expect(typeof response.last_block_indexed).toBe("number");
            expect(response.first_block_indexed).toBeDefined();
            expect(typeof response.first_block_indexed).toBe("number");
            expect(response.total_hands).toBeDefined();
            expect(typeof response.total_hands).toBe("number");
            expect(response.total_games).toBeDefined();
            expect(typeof response.total_games).toBe("number");
        });
    });

    describe("Get Summary Stats", () => {
        it("should get summary stats", async () => {
            const response = (await indexerApi.getSummaryStats()) as StatsSummary;
            expect(response).toBeDefined();
            expect(response.total_completed_hands).toBeDefined();
            expect(response.total_hands).toBeDefined();
            expect(response.total_revealed_cards).toBeDefined();
            expect(response.unique_games).toBeDefined();
        });
    });

    describe("Get Randomness Analysis", () => {
        it("should get randomness analysis", async () => {
            const response = (await indexerApi.getRandomnessAnalysis()) as RandomnessReport;
            expect(response).toBeDefined();
            expect(response.summary).toBeDefined();
            expect(response.card_chi_squared).toBeDefined();
            expect(response.suit_chi_squared).toBeDefined();
            expect(response.rank_chi_squared).toBeDefined();
            expect(typeof response.duplicate_seeds).toBe("number");
        });
    });

    describe("Get Hand Detail", () => {
        it("should get hand detail", async () => {
            const gameId = "0xd466e68331cccfab4c214171a0737a2fc80b6542cf4468d51acf4de84c77e35f"; // Replace with a valid game ID for testing
            const handNumber = "7"; // Replace with a valid hand number for testing
            const response = (await indexerApi.getHand(gameId, handNumber)) as HandDetail;
            expect(response).toBeDefined();
            expect(response.game_id).toBe(gameId);
            expect(response.hand_number).toBe(parseInt(handNumber));
            expect(response.block_height).toBeDefined();
            expect(response.deck_seed).toBeDefined();
            expect(response.deck).toBeDefined();
            expect(response.tx_hash).toBeDefined();
            expect(response.created_at).toBeDefined();
        });
    });

    describe("Get Hands List", () => {
        it("should get list of hands for a game", async () => {
            const gameId = "0xd466e68331cccfab4c214171a0737a2fc80b6542cf4468d51acf4de84c77e35f"; // Replace with a valid game ID for testing
            const response = (await indexerApi.getHands(gameId)) as HandListResponse;
            expect(response).toBeDefined();
            expect(response.pagination).toBeDefined();
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                const hand = response.data[0];
                expect(hand.game_id).toBe(gameId);
                expect(hand.hand_number).toBeDefined();
                expect(hand.block_height).toBeDefined();
                expect(hand.deck_seed).toBeDefined();
                expect(hand.deck).toBeDefined();
                expect(hand.tx_hash).toBeDefined();
                expect(hand.created_at).toBeDefined();
            }
        });
    });
});

interface CardStats {
    card: string; // "2h", "AS", etc.
    rank: string; // "A", "K", "2", etc.
    suit: string; // "h", "d", "c", "s"
    total_appearances: number;
    expected_frequency: number;
    actual_frequency: number;
    deviation: number;
    deviation_percent: number;
}

interface IndexerStatus {
    total_blocks: number;
    blocks_indexed: number;
    percent_complete: number;
    last_block_indexed: number;
    first_block_indexed: number;
    total_hands: number;
    total_games: number;
}

interface StatsSummary {
    total_hands: number;
    total_completed_hands: number;
    total_revealed_cards: number;
    unique_games: number;
}

interface RandomnessReport {
    summary: StatsSummary;
    card_chi_squared: ChiSquaredResult;
    suit_chi_squared: ChiSquaredResult;
    rank_chi_squared: ChiSquaredResult;
    outlier_cards: CardStats[];
    duplicate_seeds: number;
}

interface HandListResponse {
    data: HandListItem[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

interface HandDetail extends HandListItem {
    result: HandResult | null;
    revealed_cards: RevealedCard[];
}
