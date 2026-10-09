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

// Cosmos event attribute (key-value pairs in events)
export interface CosmosEventAttribute {
    key: string;
    value: string;
    index?: boolean;
}

// Cosmos event (emitted by transactions)
export interface CosmosEvent {
    type: string;
    attributes: CosmosEventAttribute[];
}

// Cosmos message (transaction message body)
export interface CosmosMessage {
    "@type": string;
    [key: string]: unknown;
}

export interface Transaction {
    txhash: string;
    height: string;
    code: number;
    timestamp: string;
    tx: {
        body: {
            messages: CosmosMessage[];
        };
    };
    events?: CosmosEvent[];
}

// Types for Cosmos transaction
export interface CosmosTransaction {
    tx: {
        body: {
            messages: CosmosMessage[];
        };
    };
    tx_response: {
        height: string;
        txhash: string;
        code: number;
        gas_used: string;
        gas_wanted: string;
        timestamp: string;
        events: CosmosEvent[];
    };
}

// Indexer API response types

// GET /api/v1/stats/cards
export type SuitKey = "s" | "h" | "d" | "c";

export interface CardStats {
    card: string;               // "2h", "AS", etc.
    rank: string;               // "A", "K", "2", etc.
    suit: SuitKey;
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
    card_chi_squared: ChiSquaredResult;
    suit_chi_squared: ChiSquaredResult;
    rank_chi_squared: ChiSquaredResult;
}

export type ChiSquaredName = "PASS" | "MARGINAL" | "FAIL" | "NO_DATA";

export interface ChiSquaredResult {
    chi_squared: number;
    degrees_of_freedom: number;
    p_value: number;
    result: ChiSquaredName;
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

// Cosmos REST account and validator lists (/cosmos/auth, /cosmos/staking)

export interface ValidatorEntry {
    operator_address: string;
    status: string;
    description: {
        moniker: string;
    };
}

export interface BaseAccountEntry {
    address: string;
    account_number?: string;
    sequence?: string;
}

export interface AccountEntry {
    "@type": string;
    address?: string;
    account_number?: string;
    sequence?: string;
    base_account?: BaseAccountEntry;
    base_vesting_account?: { base_account: BaseAccountEntry };
}

export interface ValidatorsResponse {
    validators: ValidatorEntry[];
}

export interface AccountsResponse {
    accounts: AccountEntry[];
}

export interface AccountBalanceResponse {
    balances: Coin[];
}
