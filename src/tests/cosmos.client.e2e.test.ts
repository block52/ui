/**
 * @jest-environment node
 */
import { CosmosApi } from "../apis/Api";

describe("Cosmos client E2E Tests", () => {
    const cosmosApi = new CosmosApi({ baseUrl: "https://node1.block52.xyz", secure: false });

    beforeAll(async () => {
        // Setup: Clean up any test data if needed
    });

    afterAll(async () => {
        // Cleanup: Remove test payment records
    });

    describe("Get Accounts", () => {
        it("should get a list of accounts", async () => {
            const response = (await cosmosApi.getAccounts()) as AccountsResponse;
            expect(response).toBeDefined();
            expect(response.pagination).toBeDefined();
            expect(response.accounts).toBeDefined();
            expect(Array.isArray(response.accounts)).toBe(true);
        });

        it("should get accounts with pagination", async () => {
            const response = (await cosmosApi.getAccounts(5)) as AccountsResponse;
            expect(response).toBeDefined();
            expect(response.pagination).toBeDefined();
            expect(response.pagination.next_key).toBeDefined();
            expect(response.accounts).toBeDefined();
            expect(Array.isArray(response.accounts)).toBe(true);
            expect(response.accounts.length).toBeLessThanOrEqual(5);
        });

        it("should get balance for a specific account", async () => {
            const cosmosAddress = "b5216t256v3nnh7ksqspup7raefyy250ef2gjgsz5v";
            const balanceResponse = (await cosmosApi.getBalanceByAddress(cosmosAddress)) as AccountBalanceResponse;
            expect(balanceResponse).toBeDefined();
            expect(balanceResponse.balances.length).toBeGreaterThan(0);
        });

        it("should get sent and received transactions for a specific account", async () => {
            const cosmosAddress = "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p";
            const senderQuery = `message.sender='${cosmosAddress}'`;
            const recipientQuery = `transfer.recipient='${cosmosAddress}'`;
            const sentTxsResponse = (await cosmosApi.getSentTransactions(senderQuery)) as TransactionResponse;
            expect(sentTxsResponse).toBeDefined();
            expect(Array.isArray(sentTxsResponse.txs)).toBe(true);
            expect(Array.isArray(sentTxsResponse.tx_responses)).toBe(true);

            const receivedTxsResponse = (await cosmosApi.getReceivedTransactions(recipientQuery)) as TransactionResponse;
            expect(receivedTxsResponse).toBeDefined();
            expect(Array.isArray(receivedTxsResponse.txs)).toBe(true);
            expect(Array.isArray(receivedTxsResponse.tx_responses)).toBe(true);
        });
    });

    describe("Get Validators", () => {
        it("should get a list of validators", async () => {
            const response = (await cosmosApi.getValidators()) as ValidatorsResponse;
            expect(response).toBeDefined();
            expect(Array.isArray(response.validators)).toBe(true);
        });

        it("should get validators with pagination", async () => {
            const response = (await cosmosApi.getValidators(5)) as ValidatorsResponse;
            expect(response).toBeDefined();
            expect(response.pagination).toBeDefined();
            expect(response.pagination.next_key).toBeDefined();
            expect(response.validators).toBeDefined();
            expect(Array.isArray(response.validators)).toBe(true);
            expect(response.validators.length).toBeLessThanOrEqual(5);
        });

        it("should get validator by status", async () => {
            const response = (await cosmosApi.getValidatorsByStatus("BOND_STATUS_BONDED")) as ValidatorsResponse;
            expect(response).toBeDefined();
            expect(Array.isArray(response.validators)).toBe(true);
            response.validators.forEach(validator => {
                expect(validator.status).toBe("BOND_STATUS_BONDED");
            });
        });
    });
});

interface CosmosAccount {
    "@type": string;
    address: string;
    pub_key?: { "@type": string; key: string } | null;
    account_number: string;
    sequence: string;
}

interface CosmosValidator {
    operator_address: string;
    consensus_pubkey?: { "@type": string; key: string };
    jailed: boolean;
    status: string;
    tokens: string;
    delegator_shares: string;
    description: {
        moniker: string;
        identity?: string;
        website?: string;
        security_contact?: string;
        details?: string;
    };
    commission: {
        commission_rates: {
            rate: string;
            max_rate: string;
            max_change_rate: string;
        };
    };
}

interface CosmosPagination {
    next_key: string | null;
    total: string;
}

interface CosmosTransactionResponse {
    height: string;
    txhash: string;
    codespace?: string;
    code: number;
    data?: string;
    raw_log?: string;
    logs?: unknown[];
    info?: string;
    gas_wanted: string;
    gas_used: string;
    tx?: unknown;
    timestamp: string;
    events?: unknown[];
}

interface AccountsResponse {
    pagination: CosmosPagination;
    accounts: CosmosAccount[];
}

interface ValidatorsResponse {
    pagination: CosmosPagination;
    validators: CosmosValidator[];
}

interface AccountBalanceResponse {
    pagination: CosmosPagination;
    balances: { denom: string; amount: string }[];
}

interface TransactionResponse {
    pagination: CosmosPagination;
    total: string;
    tx_responses: CosmosTransactionResponse[];
    txs?: unknown[]; // Include txs for message parsing
}
