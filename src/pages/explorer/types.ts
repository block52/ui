// Types from CosmosClient
export interface CosmosBlock {
    block_id: {
        hash: string;
    };
    block: {
        header: {
            height: string;
            time: string;
            chain_id: string;
            proposer_address: string;
        };
        data: {
            txs: string[]; // Base64 encoded transactions
        };
    };
}

// Types for balance and transactions
export interface Coin {
    denom: string;
    amount: string;
}

export interface Transaction {
    txhash: string;
    height: string;
    code: number;
    timestamp: string;
    tx: {
        body: {
            messages: any[];
        };
    };
    events?: any[];
}

// Types for Cosmos transaction
export interface CosmosTransaction {
    tx: {
        body: {
            messages: any[];
        };
    };
    tx_response: {
        height: string;
        txhash: string;
        code: number;
        gas_used: string;
        gas_wanted: string;
        timestamp: string;
        events: any[];
    };
}

// Indexer API response types

// GET /api/v1/stats/cards
export interface CardStats {
    card: string;               // "2h", "AS", etc.
    rank: string;               // "A", "K", "2", etc.
    suit: string;               // "h", "d", "c", "s"
    total_appearances: number;
    expected_frequency: number;
    actual_frequency: number;
    deviation: number;
    deviation_percent: number;
}

// GET /api/v1/stats/summary
export interface StatsSummary {
    total_hands: number;
    total_completed_hands: number;
    total_revealed_cards: number;
    unique_games: number;
}

// GET /api/v1/analysis/randomness
export interface RandomnessReport {
    summary: StatsSummary;
    card_chi_squared: ChiSquaredResult;
    suit_chi_squared: ChiSquaredResult;
    rank_chi_squared: ChiSquaredResult;
    outlier_cards: CardStats[];
    duplicate_seeds: number;
}

export interface ChiSquaredResult {
    chi_squared: number;
    degrees_of_freedom: number;
    p_value: number;
    result: string;         // "PASS", "MARGINAL", "FAIL"
    interpretation: string;
}

// GET /api/v1/status
export interface IndexerStatus {
    total_blocks: number;
    blocks_indexed: number;
    percent_complete: number;
    last_block_indexed: number;
    first_block_indexed: number;
    total_hands: number;
    total_games: number;
}

// GET /api/v1/hands
export interface HandListItem {
    game_id: string;
    hand_number: number;
    block_height: number;
    deck_seed: string;
    deck: string;
    tx_hash: string;
    created_at: string;
}

export interface HandListResponse {
    data: HandListItem[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

// GET /api/v1/hands/:gameId/:handNumber
export interface RevealedCard {
    id: number;
    game_id: string;
    hand_number: number;
    block_height: number;
    card: string;
    card_type: "community" | "hole";
    position: number;
    created_at: string;
}

export interface HandResult {
    game_id: string;
    hand_number: number;
    block_height: number;
    community_cards: string[];
    winner_count: number;
    tx_hash: string;
    created_at: string;
}

export interface HandDetail extends HandListItem {
    result: HandResult | null;
    revealed_cards: RevealedCard[];
}
