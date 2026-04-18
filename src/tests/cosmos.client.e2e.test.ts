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

interface AccountsResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    accounts: any[];
}

interface ValidatorsResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    validators: any[];
}

interface AccountBalanceResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    balances: { denom: string; amount: string }[];
}

interface TransactionResponse {
    pagination: any;
    total: string;
    tx_responses: any[];
    txs?: any[]; // Include txs for message parsing
}
