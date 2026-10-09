import {
    AccountBalanceResponse,
    AccountEntry,
    BaseAccountEntry,
    AccountsResponse,
    CardStats,
    ChiSquaredName,
    ChiSquaredResult,
    Coin,
    IndexerStatus,
    RandomnessReport,
    StatsSummary,
    SuitKey,
    ValidatorEntry,
    ValidatorsResponse
} from "../pages/explorer/types";

/** Validating converters for explorer API payloads: they throw a message naming the first wrong field, so a caller can show an error state instead of crashing in render. */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown, what: string): Record<string, unknown> => {
    if (!isRecord(value)) throw new Error(`${what} must be an object`);
    return value;
};

const field = (source: Record<string, unknown>, key: string, what: string): unknown => {
    if (!(key in source)) throw new Error(`${what} is missing "${key}"`);
    return source[key];
};

const text = (source: Record<string, unknown>, key: string, what: string): string => {
    const value = field(source, key, what);
    if (typeof value !== "string") throw new Error(`${what}.${key} must be a string`);
    return value;
};

const finiteNumber = (source: Record<string, unknown>, key: string, what: string): number => {
    const value = field(source, key, what);
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${what}.${key} must be a number`);
    return value;
};

const list = (value: unknown, what: string): unknown[] => {
    if (!Array.isArray(value)) throw new Error(`${what} must be an array`);
    return value;
};

const isSuitKey = (value: string): value is SuitKey => value === "s" || value === "h" || value === "d" || value === "c";

const isChiSquaredName = (value: string): value is ChiSquaredName => value === "PASS" || value === "MARGINAL" || value === "FAIL" || value === "NO_DATA";

const parseCardStat = (raw: unknown, index: number): CardStats => {
    const what = `card stat ${index}`;
    const item = record(raw, what);
    const suit = text(item, "suit", what).toLowerCase();
    if (!isSuitKey(suit)) throw new Error(`${what} has unknown suit "${suit}"`);
    return {
        card: text(item, "card", what),
        rank: text(item, "rank", what),
        suit,
        total_appearances: finiteNumber(item, "total_appearances", what),
        expected_frequency: finiteNumber(item, "expected_frequency", what),
        actual_frequency: finiteNumber(item, "actual_frequency", what),
        deviation: finiteNumber(item, "deviation", what),
        deviation_percent: finiteNumber(item, "deviation_percent", what)
    };
};

export const parseCardStats = (raw: unknown): CardStats[] => list(raw, "card stats").map(parseCardStat);

export const parseStatsSummary = (raw: unknown): StatsSummary => {
    const what = "stats summary";
    const item = record(raw, what);
    return {
        total_hands: finiteNumber(item, "total_hands", what),
        total_completed_hands: finiteNumber(item, "total_completed_hands", what),
        total_revealed_cards: finiteNumber(item, "total_revealed_cards", what),
        unique_games: finiteNumber(item, "unique_games", what)
    };
};

export const parseIndexerStatus = (raw: unknown): IndexerStatus => {
    const what = "indexer status";
    const item = record(raw, what);
    return {
        total_blocks: finiteNumber(item, "total_blocks", what),
        blocks_indexed: finiteNumber(item, "blocks_indexed", what),
        percent_complete: finiteNumber(item, "percent_complete", what),
        last_block_indexed: finiteNumber(item, "last_block_indexed", what),
        first_block_indexed: finiteNumber(item, "first_block_indexed", what),
        total_hands: finiteNumber(item, "total_hands", what),
        total_games: finiteNumber(item, "total_games", what)
    };
};

const parseChiSquared = (source: Record<string, unknown>, key: string): ChiSquaredResult => {
    const what = `randomness report ${key}`;
    const item = record(field(source, key, "randomness report"), what);
    const result = text(item, "result", what);
    if (!isChiSquaredName(result)) throw new Error(`${what} has unknown result "${result}"`);
    return {
        chi_squared: finiteNumber(item, "chi_squared", what),
        degrees_of_freedom: finiteNumber(item, "degrees_of_freedom", what),
        p_value: finiteNumber(item, "p_value", what),
        result,
        interpretation: text(item, "interpretation", what)
    };
};

export const parseRandomnessReport = (raw: unknown): RandomnessReport => {
    const item = record(raw, "randomness report");
    return {
        card_chi_squared: parseChiSquared(item, "card_chi_squared"),
        suit_chi_squared: parseChiSquared(item, "suit_chi_squared"),
        rank_chi_squared: parseChiSquared(item, "rank_chi_squared")
    };
};

const parseValidator = (raw: unknown, index: number): ValidatorEntry => {
    const what = `validator ${index}`;
    const item = record(raw, what);
    const description = record(field(item, "description", what), `${what}.description`);
    return {
        operator_address: text(item, "operator_address", what),
        status: text(item, "status", what),
        description: { moniker: text(description, "moniker", `${what}.description`) }
    };
};

export const parseValidatorsResponse = (raw: unknown): ValidatorsResponse => {
    const what = "validators response";
    const item = record(raw, what);
    return {
        validators: list(field(item, "validators", what), `${what}.validators`).map(parseValidator)
    };
};

const optionalText = (source: Record<string, unknown>, key: string, what: string): string | undefined => (key in source ? text(source, key, what) : undefined);

const parseBaseAccount = (value: unknown, what: string): BaseAccountEntry => {
    const item = record(value, what);
    return {
        address: text(item, "address", what),
        account_number: optionalText(item, "account_number", what),
        sequence: optionalText(item, "sequence", what)
    };
};

const parseAccount = (raw: unknown, index: number): AccountEntry => {
    const what = `account ${index}`;
    const item = record(raw, what);
    const entry: AccountEntry = {
        "@type": text(item, "@type", what),
        address: optionalText(item, "address", what),
        account_number: optionalText(item, "account_number", what),
        sequence: optionalText(item, "sequence", what)
    };
    if ("base_account" in item) entry.base_account = parseBaseAccount(item.base_account, `${what}.base_account`);
    if ("base_vesting_account" in item) {
        const vesting = record(item.base_vesting_account, `${what}.base_vesting_account`);
        entry.base_vesting_account = { base_account: parseBaseAccount(field(vesting, "base_account", `${what}.base_vesting_account`), `${what}.base_vesting_account.base_account`) };
    }
    return entry;
};

export const parseAccountsResponse = (raw: unknown): AccountsResponse => {
    const what = "accounts response";
    const item = record(raw, what);
    return {
        accounts: list(field(item, "accounts", what), `${what}.accounts`).map(parseAccount)
    };
};

const parseCoin = (raw: unknown, index: number): Coin => {
    const what = `balance ${index}`;
    const item = record(raw, what);
    return { denom: text(item, "denom", what), amount: text(item, "amount", what) };
};

export const parseAccountBalanceResponse = (raw: unknown): AccountBalanceResponse => {
    const what = "balances response";
    const item = record(raw, what);
    return {
        balances: list(field(item, "balances", what), `${what}.balances`).map(parseCoin)
    };
};

/** The bech32 address an account carries, whichever account variant it is, or null when it has none. */
export const accountAddressOf = (account: AccountEntry): string | null => {
    if (account.address !== undefined) return account.address;
    if (account.base_account !== undefined) return account.base_account.address;
    if (account.base_vesting_account !== undefined) return account.base_vesting_account.base_account.address;
    return null;
};

/** Short label for an account's proto type URL, e.g. "/cosmos.auth.v1beta1.BaseAccount" -> "B52 Account". */
export const accountTypeLabel = (typeUrl: string): string => {
    const name = typeUrl.slice(typeUrl.lastIndexOf(".") + 1);
    if (name === "BaseAccount") return "B52 Account";
    return name === "" ? typeUrl : name;
};

/** Filter values of the bridge deposits table. */
export type BridgeFilter = "all" | "processed" | "pending";

/** The select value as a BridgeFilter, or null for anything else. */
export const parseBridgeFilter = (value: string): BridgeFilter | null =>
    value === "all" || value === "processed" || value === "pending" ? value : null;
